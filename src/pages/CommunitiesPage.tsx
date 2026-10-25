import React, { useEffect, useState } from 'react';
import { Users, Plus, Check, Sparkles } from 'lucide-react';
import { Dialog } from '../components/common/Dialog';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Community } from '../types/database';

export const CommunitiesPage: React.FC = () => {
  const { user } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [membershipMap, setMembershipMap] = useState<Record<string, boolean>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Design');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultCommunities: Community[] = [
    {
      id: 'comm-1',
      name: 'UI/UX & Design Systems Guild',
      slug: 'ui-ux-design-systems',
      description: 'Peer feedback on Figma components, typography, design tokens, and usability audits.',
      avatar_url: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&auto=format&fit=crop&q=80',
      cover_url: null,
      category: 'Design',
      is_private: false,
      created_by: 'system',
      members_count: 1420,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'comm-2',
      name: 'Flutter & Dart Engineers',
      slug: 'flutter-dart-engineers',
      description: 'Clean Architecture, Riverpod state management, and full-stack Supabase integration.',
      avatar_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
      cover_url: null,
      category: 'Mobile Development',
      is_private: false,
      created_by: 'system',
      members_count: 980,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'comm-3',
      name: 'Python & Generative AI Lab',
      slug: 'python-generative-ai',
      description: 'LLM orchestrations, FastAPI backends, vector search, and model fine-tuning discussions.',
      avatar_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
      cover_url: null,
      category: 'Programming',
      is_private: false,
      created_by: 'system',
      members_count: 2150,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'comm-4',
      name: 'Cinematic Video Editors & VFX',
      slug: 'video-editors-vfx',
      description: 'Color grading LUTs, Premiere Pro workflows, DaVinci Resolve timelines, and sound design.',
      avatar_url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=80',
      cover_url: null,
      category: 'Video & Audio',
      is_private: false,
      created_by: 'system',
      members_count: 730,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const loadCommunities = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .order('members_count', { ascending: false });

      if (!error && data && data.length > 0) {
        setCommunities(data as Community[]);
      } else {
        setCommunities(defaultCommunities);
      }

      if (user) {
        const { data: memberData } = await supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', user.id);

        if (memberData) {
          const map: Record<string, boolean> = {};
          memberData.forEach((m) => {
            map[m.community_id] = true;
          });
          setMembershipMap(map);
        }
      }
    } catch (_) {
      setCommunities(defaultCommunities);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, [user]);

  const toggleJoin = async (communityId: string) => {
    if (!user) return;
    const isMember = !!membershipMap[communityId];
    setMembershipMap((prev) => ({ ...prev, [communityId]: !isMember }));

    try {
      if (isMember) {
        await supabase
          .from('community_members')
          .delete()
          .eq('community_id', communityId)
          .eq('user_id', user.id);
      } else {
        await supabase.from('community_members').insert({
          community_id: communityId,
          user_id: user.id,
        });
      }
    } catch (_) {}
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data, error } = await supabase
        .from('communities')
        .insert({
          name: name.trim(),
          slug,
          description: description.trim() || null,
          category,
          created_by: user.id,
          members_count: 1,
        })
        .select()
        .single();

      if (!error && data) {
        // Auto-join as admin
        await supabase.from('community_members').insert({
          community_id: data.id,
          user_id: user.id,
          role: 'admin',
        });
        setCommunities((prev) => [data as Community, ...prev]);
        setMembershipMap((prev) => ({ ...prev, [data.id]: true }));
        setIsCreateOpen(false);
        setName('');
        setDescription('');
      }
    } catch (_) {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-[#292B34]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-[#15161B] border border-[#292B34] flex items-center justify-center text-[#E5484D]">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#F5F5F7]">Skill Communities</h1>
            <p className="text-xs text-[#858995]">
              Join groups dedicated to specific skills, ask questions, and share project resources.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setIsCreateOpen(true)}
        >
          Create Community
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-[#858995]">Loading skill communities...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {communities.map((comm) => {
          const isMember = !!membershipMap[comm.id];
          return (
            <div
              key={comm.id}
              className="bg-[#15161B] border border-[#292B34] rounded-[16px] p-5 flex flex-col justify-between gap-4 hover:border-[#393C47] transition-all shadow-card"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-[12px] bg-[#1B1D24] border border-[#292B34] overflow-hidden shrink-0 flex items-center justify-center">
                  {comm.avatar_url ? (
                    <img
                      src={comm.avatar_url}
                      alt={comm.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-6 h-6 text-[#858995]" />
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#F5F5F7] truncate">
                      {comm.name}
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#E5484D] font-medium">
                    {comm.category} • {comm.members_count} members
                  </span>
                  <p className="text-xs text-[#B0B3BD] leading-relaxed mt-1.5 line-clamp-2">
                    {comm.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#292B34]/60">
                <span className="text-[11px] text-[#858995] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#E5484D]" />
                  <span>Free Resource Exchange</span>
                </span>

                <button
                  onClick={() => toggleJoin(comm.id)}
                  className={`px-3.5 py-1.5 rounded-[8px] text-xs font-semibold transition-colors flex items-center gap-1 ${
                    isMember
                      ? 'bg-[#1B1D24] text-[#B0B3BD] border border-[#292B34] hover:bg-[#282A32]'
                      : 'bg-[#E5484D] hover:bg-[#D7373F] text-white shadow-xs'
                  }`}
                >
                  {isMember ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Joined</span>
                    </>
                  ) : (
                    <span>Join Community</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}

      {/* Create Community Dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Skill Community"
        maxWidth="md"
      >
        <form onSubmit={handleCreateCommunity} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#B0B3BD]">Community Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Next.js & Fullstack Builders"
              className="w-full bg-[#15161B] text-[#F5F5F7] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#B0B3BD]">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#15161B] text-[#F5F5F7] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
            >
              <option value="Design">UI/UX & Graphic Design</option>
              <option value="Mobile Development">Mobile Development</option>
              <option value="Programming">Programming & Systems</option>
              <option value="Video & Audio">Video & Audio</option>
              <option value="AI & Data">AI & Data Science</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#B0B3BD]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What skills will members share and practice in this group?"
              className="w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#292B34]/60">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
              Create Group
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
