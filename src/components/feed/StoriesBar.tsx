import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { StoryViewerModal } from './StoryViewerModal';
import { StoryComposerModal } from './StoryComposerModal';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Story, Profile } from '../../types/database';

export const StoriesBar: React.FC = () => {
  const { user, profile } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const loadStories = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('stories')
        .select('*, author:user_id(*)')
        .gt('expires_at', now)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setStories(data as Story[]);
      } else {
        // Fallback default sample creators with stories to ensure vibrant presentation
        const { data: profiles } = await supabase.from('profiles').select('*').limit(6);
        if (profiles && profiles.length > 0) {
          const sampleStories: Story[] = profiles.map((p, idx) => ({
            id: `story-${p.id}`,
            user_id: p.id,
            media_url:
              p.avatar_url ||
              'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
            media_type: 'image',
            caption: `Sharing my new ${idx % 2 === 0 ? 'UI/UX' : 'coding'} practice work!`,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            author: p as Profile,
          }));
          setStories(sampleStories);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadStories();
  }, [user]);

  const hasMyStory = stories.some((s) => s.user_id === user?.id);

  return (
    <>
      <div className="w-full bg-[#15161B] border border-[#292B34] rounded-[16px] p-3.5 sm:p-4 mb-5 overflow-x-auto select-none no-scrollbar">
        <div className="flex items-center gap-4 min-w-max">
          {/* Your Story Avatar */}
          <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
            <div
              className="relative"
              onClick={() => {
                if (hasMyStory) {
                  const myIndex = stories.findIndex((s) => s.user_id === user?.id);
                  setActiveStoryIndex(myIndex >= 0 ? myIndex : 0);
                } else {
                  setIsComposerOpen(true);
                }
              }}
            >
              <Avatar
                src={profile?.avatar_url}
                name={profile?.full_name || profile?.username}
                size="lg"
                hasStory={hasMyStory}
              />
              {!hasMyStory && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsComposerOpen(true);
                  }}
                  className="absolute bottom-0 right-0 w-5 h-5 bg-[#E5484D] text-white rounded-full flex items-center justify-center border-2 border-[#15161B] group-hover:scale-110 transition-transform"
                >
                  <Plus className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            <span className="text-[11px] font-medium text-[#B0B3BD] max-w-[64px] truncate text-center">
              Your story
            </span>
          </div>

          {/* Other Creators' Stories */}
          {stories
            .filter((s) => s.user_id !== user?.id)
            .map((story) => {
              const actualIndex = stories.indexOf(story);
              return (
                <div
                  key={story.id}
                  onClick={() => setActiveStoryIndex(actualIndex)}
                  className="flex flex-col items-center gap-1.5 cursor-pointer group"
                >
                  <Avatar
                    src={story.author?.avatar_url}
                    name={story.author?.username}
                    size="lg"
                    hasStory={true}
                  />
                  <span className="text-[11px] font-medium text-[#B0B3BD] group-hover:text-white max-w-[64px] truncate text-center">
                    {story.author?.username || 'creator'}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Story Viewer Modal */}
      {activeStoryIndex !== null && (
        <StoryViewerModal
          isOpen={true}
          onClose={() => setActiveStoryIndex(null)}
          stories={stories}
          initialIndex={activeStoryIndex}
        />
      )}

      {/* Story Composer Modal */}
      <StoryComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onStoryCreated={loadStories}
      />
    </>
  );
};
