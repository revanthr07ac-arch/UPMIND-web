import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../common/Avatar';
import type { Profile } from '../../types/database';

export const RightSidebar: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [suggestedCreators, setSuggestedCreators] = useState<Profile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);

  useEffect(() => {
    async function loadSuggestions() {
      setLoadingCreators(true);
      try {
        // Fetch blocked users if authenticated
        const blockedUserIds = new Set<string>();
        if (user) {
          try {
            const { data: blocks } = await supabase
              .from('blocks')
              .select('blocked_id, blocker_id')
              .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
            if (blocks) {
              blocks.forEach((b: { blocker_id: string; blocked_id: string }) => {
                if (b.blocker_id === user.id) blockedUserIds.add(b.blocked_id);
                if (b.blocked_id === user.id) blockedUserIds.add(b.blocker_id);
              });
            }
          } catch (_) {
            // Ignore block fetch error if table not configured
          }
        }

        let query = supabase
          .from('profiles')
          .select('*')
          .limit(8);

        if (user) {
          query = query.neq('id', user.id);
        }

        const { data } = await query;
        if (data) {
          // Filter out blocked users
          const filtered = (data as Profile[])
            .filter((p) => !blockedUserIds.has(p.id))
            .slice(0, 5);

          setSuggestedCreators(filtered);

          // Check if current user follows them
          if (user && filtered.length > 0) {
            const ids = filtered.map((d) => d.id);
            const { data: followRecords } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', user.id)
              .in('following_id', ids);

            if (followRecords) {
              const map: Record<string, boolean> = {};
              followRecords.forEach((f) => {
                map[f.following_id] = true;
              });
              setFollowingMap(map);
            }
          }
        }
      } catch (_) {
        // Handle error gracefully
      } finally {
        setLoadingCreators(false);
      }
    }

    loadSuggestions();
  }, [user]);

  useEffect(() => {
    async function loadSkills() {
      try {
        const { data } = await supabase
          .from('skills')
          .select('name')
          .limit(8);

        if (data && data.length > 0) {
          setSkillCategories(data.map((s: { name: string }) => s.name));
        }
      } catch (_) {
        // Fallback silently if skills table is not yet populated
      }
    }

    loadSkills();
  }, []);

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

        // Trigger notification
        await supabase.from('notifications').insert({
          recipient_id: creatorId,
          actor_id: user.id,
          type: 'follow',
        });
      }
    } catch (_) {
      // Revert on error
      setFollowingMap((prev) => ({ ...prev, [creatorId]: isFollowing }));
    }
  };

  return (
    <aside className="hidden xl:flex flex-col w-80 h-screen sticky top-0 px-6 py-8 overflow-y-auto shrink-0 select-none border-l border-[#292B34]/40">
      {/* Current User Card */}
      {profile && (
        <div
          onClick={() => navigate(`/u/${profile.username}`)}
          className="flex items-center justify-between p-3 rounded-[14px] bg-[#15161B]/50 border border-[#292B34]/60 hover:border-[#393C47] transition-all cursor-pointer mb-6 group"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar
              src={profile.avatar_url}
              name={profile.full_name || profile.username}
              size="md"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-[#F5F5F7] truncate">
                {profile.display_name || profile.full_name || profile.username}
              </span>
              <span className="text-xs text-[#858995] truncate">@{profile.username}</span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-[#858995] group-hover:text-[#F5F5F7] shrink-0 ml-2">
            Profile
          </span>
        </div>
      )}

      {/* Differentiator Callout Card */}
      <div className="p-4 rounded-[16px] bg-gradient-to-br from-[#15161B] to-[#1B1D24] border border-[#292B34] mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#E5484D]/5 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-2 text-xs font-bold text-[#E5484D] uppercase tracking-wider mb-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Peer Learning</span>
        </div>
        <h4 className="text-sm font-semibold text-[#F5F5F7] mb-1">
          Zero-Cost Skill Sharing
        </h4>
        <p className="text-xs text-[#B0B3BD] leading-relaxed mb-3">
          Request source files, guides, and notes directly from creators. No paywalls, ever.
        </p>
        <button
          onClick={() => navigate('/learn')}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[8px] bg-[#E5484D]/10 hover:bg-[#E5484D]/20 text-[#E5484D] text-xs font-semibold border border-[#E5484D]/30 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Explore Learning Hub</span>
          <ArrowRight className="w-3 h-3 ml-0.5" />
        </button>
      </div>

      {/* Suggested Creators */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-[#858995] uppercase tracking-wider">
            Suggested Creators
          </span>
          <button
            onClick={() => navigate('/explore')}
            className="text-xs font-medium text-[#B0B3BD] hover:text-[#F5F5F7]"
          >
            See All
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {loadingCreators ? (
            <div className="space-y-2 py-1">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-2.5 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-[#1B1D24]" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-20 bg-[#1B1D24] rounded" />
                    <div className="h-2 w-14 bg-[#15161B] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : suggestedCreators.length > 0 ? (
            suggestedCreators.map((creator) => {
              const isFollowing = !!followingMap[creator.id];
              return (
                <div
                  key={creator.id}
                  className="flex items-center justify-between gap-3 group"
                >
                  <div
                    onClick={() => navigate(`/u/${creator.username}`)}
                    className="flex items-center gap-2.5 overflow-hidden cursor-pointer flex-1"
                  >
                    <Avatar
                      src={creator.avatar_url}
                      name={creator.full_name || creator.username}
                      size="sm"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-[#F5F5F7] group-hover:text-white truncate">
                        {creator.display_name || creator.full_name || creator.username}
                      </span>
                      <span className="text-[11px] text-[#858995] truncate">
                        @{creator.username}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleFollow(creator.id)}
                    className={`text-xs font-semibold px-3 py-1 rounded-[8px] transition-all shrink-0 ${
                      isFollowing
                        ? 'bg-[#1B1D24] text-[#B0B3BD] hover:bg-[#282A32] border border-[#292B34]'
                        : 'bg-[#E5484D] hover:bg-[#D7373F] text-white shadow-xs'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-[#858995] py-1">No suggestions available right now.</p>
          )}
        </div>
      </div>

      {/* Available Skill Categories */}
      {skillCategories.length > 0 && (
        <div className="mb-6">
          <span className="text-xs font-bold text-[#858995] uppercase tracking-wider block mb-3">
            Skill Categories
          </span>
          <div className="flex flex-wrap gap-1.5">
            {skillCategories.map((skill) => (
              <button
                key={skill}
                onClick={() => navigate(`/communities?search=${encodeURIComponent(skill)}`)}
                className="text-xs px-2.5 py-1 rounded-[8px] bg-[#15161B] hover:bg-[#1B1D24] text-[#B0B3BD] hover:text-[#F5F5F7] border border-[#292B34] transition-colors"
              >
                #{skill}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer Info with Valid Working Routes */}
      <div className="mt-auto pt-6 text-[11px] text-[#858995]/80 space-y-2 border-t border-[#292B34]/40">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <button onClick={() => navigate('/learn')} className="hover:underline hover:text-[#F5F5F7]">Learn</button>
          <span>•</span>
          <button onClick={() => navigate('/communities')} className="hover:underline hover:text-[#F5F5F7]">Communities</button>
          <span>•</span>
          <button onClick={() => navigate('/explore')} className="hover:underline hover:text-[#F5F5F7]">Explore</button>
          <span>•</span>
          <button onClick={() => navigate('/settings')} className="hover:underline hover:text-[#F5F5F7]">Settings</button>
        </div>
        <p>© 2026 UPMIND — Learn. Create. Connect.</p>
      </div>
    </aside>
  );
};
