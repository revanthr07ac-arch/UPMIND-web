import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Grid,
  Film,
  Bookmark,
  GraduationCap,
  MapPin,
  Building,
  Globe,
  Settings,
  MessageCircle,
  UserPlus,
  Check,
  Sparkles,
} from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import { LearningRequestModal } from '../components/learning/LearningRequestModal';
import { PostCommentsModal } from '../components/feed/PostCommentsModal';
import { ShareModal } from '../components/feed/ShareModal';
import { formatNumber, isReelPost } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Profile, Post, UserSkill } from '../types/database';

export const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'skills'>('posts');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modals for post interactions
  const [selectedPostForMaterials, setSelectedPostForMaterials] = useState<Post | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);

  const isSelf = myProfile?.username === username || (!username && !!myProfile);

  const loadProfileData = useCallback(async () => {
    setIsLoading(true);
    try {
      let profileRow: Profile | null = null;

      if (isSelf && myProfile) {
        profileRow = myProfile;
      } else if (username) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username.toLowerCase())
          .maybeSingle();

        if (data) {
          profileRow = data as Profile;
        }
      }

      if (!profileRow) {
        setIsLoading(false);
        return;
      }

      setTargetProfile(profileRow);

      // 1. Fetch user's skills
      const { data: skillsData } = await supabase
        .from('user_skills')
        .select('*, skill:skill_id(*)')
        .eq('user_id', profileRow.id);

      if (skillsData) {
        setUserSkills(skillsData as UserSkill[]);
      }

      // 2. Fetch user's posts
      const { data: postsData } = await supabase
        .from('posts')
        .select('*, author:author_id(*)')
        .eq('author_id', profileRow.id)
        .order('created_at', { ascending: false });

      if (postsData) {
        setPosts(postsData as Post[]);
      }

      // 3. If self, fetch saved posts
      if (isSelf && user) {
        const { data: savedData } = await supabase
          .from('saved_posts')
          .select('*, post:post_id(*, author:author_id(*))')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (savedData) {
          const extracted = savedData
            .map((s) => s.post)
            .filter(Boolean) as Post[];
          setSavedPosts(extracted);
        }
      }

      // 4. Check follow relationship if not self
      if (user && !isSelf && profileRow) {
        const { data: followRecord } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', profileRow.id)
          .maybeSingle();

        setIsFollowing(!!followRecord);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [username, isSelf, myProfile, user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const toggleFollow = async () => {
    if (!user || !targetProfile) {
      navigate('/login');
      return;
    }

    const nextState = !isFollowing;
    setIsFollowing(nextState);

    // Optimistically update counts
    setTargetProfile((prev) =>
      prev
        ? {
            ...prev,
            followers_count: nextState
              ? prev.followers_count + 1
              : Math.max(0, prev.followers_count - 1),
          }
        : null
    );

    try {
      if (nextState) {
        await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: targetProfile.id,
        });
        await supabase.from('notifications').insert({
          recipient_id: targetProfile.id,
          actor_id: user.id,
          type: 'follow',
        });
      } else {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetProfile.id);
      }
    } catch (_) {
      setIsFollowing(!nextState);
    }
  };

  const startDirectMessage = async () => {
    if (!user || !targetProfile) {
      navigate('/login');
      return;
    }

    try {
      const { data: memberRows } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      const convIds = memberRows?.map((m) => m.conversation_id) || [];
      if (convIds.length > 0) {
        const { data: match } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', targetProfile.id)
          .in('conversation_id', convIds)
          .maybeSingle();

        if (match) {
          navigate(`/messages?conv=${match.conversation_id}`);
          return;
        }
      }

      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ created_by: user.id })
        .select()
        .single();

      if (newConv) {
        await supabase.from('conversation_members').insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: targetProfile.id },
        ]);
        navigate(`/messages?conv=${newConv.id}`);
      }
    } catch (_) {
      navigate('/messages');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-[#E5484D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!targetProfile) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-lg font-bold text-[#F5F5F7] mb-2">User Not Found</h2>
        <p className="text-xs text-[#858995] mb-4">The profile @{username} does not exist or has been removed.</p>
        <Button variant="primary" size="sm" onClick={() => navigate('/')}>
          Return Home
        </Button>
      </div>
    );
  }

  const teachingSkills = userSkills.filter((s) => s.intent === 'teaching');
  const learningSkills = userSkills.filter((s) => s.intent === 'learning');

  return (
    <div className="w-full flex flex-col gap-6 select-none">
      {/* Profile Header */}
      <div className="w-full bg-[#15161B] border border-[#292B34] rounded-[20px] p-5 sm:p-7 flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-card">
        {/* Avatar */}
        <Avatar
          src={targetProfile.avatar_url}
          name={targetProfile.full_name || targetProfile.username}
          size="2xl"
          hasStory={true}
        />

        {/* Profile Info */}
        <div className="flex-1 flex flex-col items-center sm:items-start gap-3 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h1 className="text-xl font-bold text-[#F5F5F7]">
                  {targetProfile.display_name || targetProfile.full_name || targetProfile.username}
                </h1>
                <span className="text-xs text-[#858995]">@{targetProfile.username}</span>
              </div>

              {/* Experience badge */}
              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-[6px] bg-[#E5484D]/15 text-[#E5484D] uppercase tracking-wider border border-[#E5484D]/30">
                {targetProfile.experience_level || 'beginner'} creator
              </span>
            </div>

            {/* Profile Actions */}
            <div className="flex items-center gap-2 justify-center">
              {isSelf ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    Edit Profile
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/settings')}
                    aria-label="Settings"
                  >
                    <Settings className="w-4 h-4 text-[#858995]" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleFollow}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-semibold transition-all shadow-xs ${
                      isFollowing
                        ? 'bg-[#1B1D24] text-[#B0B3BD] hover:bg-[#282A32] border border-[#292B34]'
                        : 'bg-[#E5484D] hover:bg-[#D7373F] text-white'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={startDirectMessage}
                    leftIcon={<MessageCircle className="w-3.5 h-3.5" />}
                  >
                    Message
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Stats Counters */}
          <div className="flex items-center gap-6 py-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#F5F5F7] text-sm">{posts.length}</span>
              <span className="text-[#858995]">posts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#F5F5F7] text-sm">
                {formatNumber(targetProfile.followers_count)}
              </span>
              <span className="text-[#858995]">followers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#F5F5F7] text-sm">
                {formatNumber(targetProfile.following_count)}
              </span>
              <span className="text-[#858995]">following</span>
            </div>
          </div>

          {/* Bio */}
          {targetProfile.bio && (
            <p className="text-xs text-[#B0B3BD] leading-relaxed text-center sm:text-left whitespace-pre-line">
              {targetProfile.bio}
            </p>
          )}

          {/* Meta details (institution, location, website) */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#858995] pt-1">
            {targetProfile.institution && (
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-[#E5484D]" />
                <span>
                  {targetProfile.institution}
                  {targetProfile.course ? ` • ${targetProfile.course}` : ''}
                </span>
              </span>
            )}
            {targetProfile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#E5484D]" />
                <span>{targetProfile.location}</span>
              </span>
            )}
            {targetProfile.website_url && (
              <a
                href={targetProfile.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#E5484D] hover:underline"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Portfolio</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Skills Offered & Learning Section */}
      <div className="w-full bg-[#15161B] border border-[#292B34] rounded-[16px] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#292B34]/60 pb-2">
          <span className="text-xs font-bold text-[#858995] uppercase tracking-wider flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-[#E5484D]" />
            <span>Skill Portfolio</span>
          </span>
          <span className="text-[11px] text-[#858995]">Peer Learning Ready</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Can Teach */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#35B883] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Can Teach & Mentor
            </span>
            <div className="flex flex-wrap gap-1.5">
              {teachingSkills.length > 0 ? (
                teachingSkills.map((s) => (
                  <span
                    key={s.id}
                    className="text-xs px-2.5 py-1 rounded-[8px] bg-[#35B883]/10 text-[#35B883] border border-[#35B883]/30 font-medium"
                  >
                    {s.skill?.name || 'Specialty'}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[#858995]">
                  UI/UX Design, Flutter & Mobile Development
                </span>
              )}
            </div>
          </div>

          {/* Want to Learn */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#FF7479] flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" />
              Currently Learning
            </span>
            <div className="flex flex-wrap gap-1.5">
              {learningSkills.length > 0 ? (
                learningSkills.map((s) => (
                  <span
                    key={s.id}
                    className="text-xs px-2.5 py-1 rounded-[8px] bg-[#FF7479]/10 text-[#FF7479] border border-[#FF7479]/30 font-medium"
                  >
                    {s.skill?.name || 'Skill'}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[#858995]">
                  AI Engineering, Python, Video Editing
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Content Tabs */}
      <div className="flex items-center justify-center gap-8 border-b border-[#292B34] text-xs font-semibold select-none">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-1.5 py-3 transition-colors relative ${
            activeTab === 'posts' ? 'text-white' : 'text-[#858995] hover:text-[#B0B3BD]'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Posts</span>
          {activeTab === 'posts' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E5484D] rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('reels')}
          className={`flex items-center gap-1.5 py-3 transition-colors relative ${
            activeTab === 'reels' ? 'text-white' : 'text-[#858995] hover:text-[#B0B3BD]'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Reels</span>
          {activeTab === 'reels' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E5484D] rounded-full" />
          )}
        </button>

        {isSelf && (
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-1.5 py-3 transition-colors relative ${
              activeTab === 'saved' ? 'text-white' : 'text-[#858995] hover:text-[#B0B3BD]'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Saved</span>
            {activeTab === 'saved' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E5484D] rounded-full" />
            )}
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'posts' && (
          posts.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#858995]">
              No posts published yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="aspect-square bg-[#15161B] rounded-[14px] overflow-hidden border border-[#292B34] relative group cursor-pointer"
                  onClick={() => setSelectedPostForComments(post)}
                >
                  {post.image_url || post.video_url ? (
                    <img
                      src={post.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'}
                      alt={post.caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full p-4 flex flex-col justify-between bg-[#1B1D24]">
                      <span className="text-xs text-[#F5F5F7] line-clamp-4 leading-relaxed">
                        {post.caption}
                      </span>
                      <span className="text-[10px] text-[#E5484D] font-bold">
                        {post.skill_tags?.[0] || '#Skill'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'reels' && (
          posts.filter((p) => isReelPost(p)).length === 0 ? (
            <div className="py-12 text-center text-xs text-[#858995]">
              No reels published yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {posts
                .filter((p) => isReelPost(p))
                .map((post) => (
                  <div
                    key={post.id}
                    onClick={() => navigate('/reels')}
                    className="aspect-[9/16] bg-black rounded-[14px] overflow-hidden border border-[#292B34] relative cursor-pointer"
                  >
                    <video
                      src={post.video_url || post.image_url || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
            </div>
          )
        )}

        {activeTab === 'saved' && (
          savedPosts.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#858995]">
              No saved posts yet. Bookmark tutorials from the feed to view them here.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {savedPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPostForComments(post)}
                  className="aspect-square bg-[#15161B] rounded-[14px] overflow-hidden border border-[#292B34] cursor-pointer"
                >
                  <img
                    src={post.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'}
                    alt={post.caption}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && targetProfile && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          profile={targetProfile}
          onProfileUpdated={() => {
            loadProfileData();
            refreshProfile();
          }}
        />
      )}

      {/* Learning Request Modal */}
      <LearningRequestModal
        isOpen={!!selectedPostForMaterials}
        onClose={() => setSelectedPostForMaterials(null)}
        post={selectedPostForMaterials}
      />

      {/* Comments Modal */}
      <PostCommentsModal
        isOpen={!!selectedPostForComments}
        onClose={() => setSelectedPostForComments(null)}
        post={selectedPostForComments}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={!!selectedPostForShare}
        onClose={() => setSelectedPostForShare(null)}
        post={selectedPostForShare}
      />
    </div>
  );
};
