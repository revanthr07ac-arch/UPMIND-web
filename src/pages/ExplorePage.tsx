import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Heart, MessageCircle, BookOpen, UserPlus, Check } from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { PostCard } from '../components/feed/PostCard';
import { LearningRequestModal } from '../components/learning/LearningRequestModal';
import { PostCommentsModal } from '../components/feed/PostCommentsModal';
import { ShareModal } from '../components/feed/ShareModal';
import type { Post, Profile } from '../types/database';

export const ExplorePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialSkill = searchParams.get('skill') || '';
  const [searchQuery, setSearchQuery] = useState(initialSkill);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [posts, setPosts] = useState<Post[]>([]);
  const [creators, setCreators] = useState<Profile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active post for detail modal
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [selectedPostForMaterials, setSelectedPostForMaterials] = useState<Post | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);

  const categories = [
    'All',
    'UI/UX Design',
    'Mobile Development',
    'Programming',
    'Graphic Design',
    'Video Editing',
    'AI & Prompting',
    'Data Science',
  ];

  useEffect(() => {
    async function loadExploreData() {
      setIsLoading(true);
      try {
        // 1. Fetch explore posts
        const { data: postsData } = await supabase
          .from('posts')
          .select('*, author:author_id(*)')
          .order('likes_count', { ascending: false })
          .limit(30);

        if (postsData) {
          setPosts(postsData as Post[]);
        }

        // 2. Fetch popular creators
        const { data: creatorsData } = await supabase
          .from('profiles')
          .select('*')
          .order('followers_count', { ascending: false })
          .limit(8);

        if (creatorsData) {
          setCreators(creatorsData as Profile[]);
          if (user && creatorsData.length > 0) {
            const ids = creatorsData.map((c) => c.id);
            const { data: follows } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', user.id)
              .in('following_id', ids);

            if (follows) {
              const map: Record<string, boolean> = {};
              follows.forEach((f) => {
                map[f.following_id] = true;
              });
              setFollowingMap(map);
            }
          }
        }
      } catch (err) {
        console.error('Explore load error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadExploreData();
  }, [user]);

  const toggleFollow = async (creatorId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const isFollowing = !!followingMap[creatorId];
    setFollowingMap((prev) => ({ ...prev, [creatorId]: !isFollowing }));

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', creatorId);
      } else {
        await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: creatorId,
        });
        await supabase.from('notifications').insert({
          recipient_id: creatorId,
          actor_id: user.id,
          type: 'follow',
        });
      }
    } catch (_) {
      setFollowingMap((prev) => ({ ...prev, [creatorId]: isFollowing }));
    }
  };

  // Filter posts based on search query and category
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        post.caption.toLowerCase().includes(q) ||
        post.author?.username.toLowerCase().includes(q) ||
        post.author?.full_name?.toLowerCase().includes(q) ||
        post.skill_tags.some((tag) => tag.toLowerCase().includes(q));

      const matchesCategory =
        selectedCategory === 'All' ||
        post.skill_tags.some((t) =>
          t.toLowerCase().includes(selectedCategory.toLowerCase())
        );

      return matchesQuery && matchesCategory;
    });
  }, [posts, searchQuery, selectedCategory]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Search Input */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-[#858995] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search creators, skills, tutorials, tags (#UI/UX, Python, Flutter)..."
          className="w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-sm rounded-[14px] border border-[#292B34] pl-10 pr-4 py-3 focus:border-[#FF7479] focus:outline-none transition-colors"
        />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`text-xs px-3.5 py-1.5 rounded-[10px] font-medium transition-all shrink-0 ${
              selectedCategory === cat
                ? 'bg-[#E5484D] text-white shadow-xs'
                : 'bg-[#15161B] text-[#B0B3BD] hover:text-[#F5F5F7] hover:bg-[#1B1D24] border border-[#292B34]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Recommended Creators Carousel / Row */}
      {creators.length > 0 && !searchQuery && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#858995] uppercase tracking-wider">
              Top Mentors & Creators
            </span>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
            {creators.map((c) => {
              const isFollowing = !!followingMap[c.id];
              return (
                <div
                  key={c.id}
                  className="w-40 bg-[#15161B] border border-[#292B34] rounded-[16px] p-3 flex flex-col items-center text-center shrink-0 hover:border-[#393C47] transition-all"
                >
                  <Avatar
                    src={c.avatar_url}
                    name={c.full_name || c.username}
                    size="lg"
                    hasStory={true}
                    onClick={() => navigate(`/u/${c.username}`)}
                  />
                  <span
                    onClick={() => navigate(`/u/${c.username}`)}
                    className="text-xs font-semibold text-[#F5F5F7] hover:underline cursor-pointer mt-2 truncate w-full"
                  >
                    {c.display_name || c.username}
                  </span>
                  <span className="text-[10px] text-[#858995] truncate w-full mb-2.5">
                    @{c.username}
                  </span>
                  {user?.id !== c.id && (
                    <button
                      onClick={() => toggleFollow(c.id)}
                      className={`w-full py-1 text-xs font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1 ${
                        isFollowing
                          ? 'bg-[#1B1D24] text-[#B0B3BD] border border-[#292B34]'
                          : 'bg-[#E5484D] hover:bg-[#D7373F] text-white'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Discovery Grid */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold text-[#858995] uppercase tracking-wider">
          Explore Showcase
        </span>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="w-full aspect-square bg-[#15161B] rounded-[14px] animate-pulse"
              />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#858995] bg-[#15161B]/50 rounded-[16px] border border-[#292B34]">
            No matching posts found. Try another search keyword or category.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => setActivePost(post)}
                className="group relative aspect-square bg-[#15161B] rounded-[14px] overflow-hidden border border-[#292B34] cursor-pointer"
              >
                {post.image_url || post.video_url ? (
                  <img
                    src={post.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'}
                    alt={post.caption}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full p-4 flex flex-col justify-between bg-gradient-to-br from-[#15161B] to-[#1B1D24]">
                    <span className="text-xs text-[#F5F5F7] line-clamp-4 leading-relaxed font-medium">
                      {post.caption}
                    </span>
                    <span className="text-[10px] text-[#E5484D] font-semibold">
                      {post.skill_tags?.[0] || '#Skill'}
                    </span>
                  </div>
                )}

                {/* Tutorial overlay tag */}
                {post.post_type === 'tutorial' && (
                  <div className="absolute top-2 left-2 p-1 rounded-md bg-black/70 backdrop-blur-xs text-[#E5484D]">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Hover overlay with engagement stats */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white font-semibold text-xs select-none">
                  <div className="flex items-center gap-1">
                    <Heart className="w-4 h-4 fill-white" />
                    <span>{post.likes_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>{post.comments_count || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Post Detail Modal */}
      {activePost && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActivePost(null)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <PostCard
              post={activePost}
              onRequestMaterials={(p) => setSelectedPostForMaterials(p)}
              onOpenComments={(p) => setSelectedPostForComments(p)}
              onOpenShare={(p) => setSelectedPostForShare(p)}
            />
          </div>
        </div>
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
