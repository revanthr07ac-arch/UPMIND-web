import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { StoryViewerModal } from './StoryViewerModal';
import { StoryComposerModal } from './StoryComposerModal';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Story } from '../../types/database';

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
        // Only real published stories - never display fake or sample stories
        setStories([]);
      }
    } catch (_) {
      setStories([]);
    }
  };

  useEffect(() => {
    loadStories();

    const handleRefresh = () => loadStories();
    window.addEventListener('upmind:refreshStories', handleRefresh);
    window.addEventListener('upmind:refreshFeed', handleRefresh);
    return () => {
      window.removeEventListener('upmind:refreshStories', handleRefresh);
      window.removeEventListener('upmind:refreshFeed', handleRefresh);
    };
  }, [user]);

  const hasMyStory = stories.some((s) => s.user_id === user?.id);

  return (
    <>
      <div className="w-full bg-surface border border-theme rounded-[16px] p-3.5 sm:p-4 mb-5 overflow-x-auto select-none no-scrollbar">
        <div className="flex items-center gap-4 min-w-max">
          {/* Your Story Avatar */}
          <div
            className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0"
            onClick={() => {
              if (hasMyStory) {
                const myIndex = stories.findIndex((s) => s.user_id === user?.id);
                setActiveStoryIndex(myIndex >= 0 ? myIndex : 0);
              } else {
                setIsComposerOpen(true);
              }
            }}
          >
            <div className="relative">
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
                  className="absolute bottom-0 right-0 w-5 h-5 bg-[#FF304F] text-white rounded-full flex items-center justify-center border-2 border-surface group-hover:scale-110 transition-transform"
                  title="Add Your Story"
                >
                  <Plus className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            <span className="text-[11px] font-medium text-secondary max-w-[64px] truncate text-center">
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
                  className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0"
                >
                  <Avatar
                    src={story.author?.avatar_url}
                    name={story.author?.username}
                    size="lg"
                    hasStory={true}
                  />
                  <span className="text-[11px] font-medium text-secondary group-hover:text-primary max-w-[64px] truncate text-center">
                    {story.author?.username || 'creator'}
                  </span>
                </div>
              );
            })}

          {/* Clean Empty State when nobody has uploaded a story */}
          {stories.length === 0 && (
            <div className="flex items-center gap-2.5 pl-3 py-1 text-xs border-l border-theme">
              <span className="text-secondary font-medium">No stories yet</span>
              <button
                type="button"
                onClick={() => setIsComposerOpen(true)}
                className="px-2.5 py-1 text-[11px] font-semibold text-[#FF304F] hover:bg-[#FF304F]/10 rounded-[8px] border border-[#FF304F]/30 transition-colors cursor-pointer"
              >
                Add Your Story
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Story Viewer Modal */}
      {activeStoryIndex !== null && (
        <StoryViewerModal
          isOpen={true}
          onClose={() => setActiveStoryIndex(null)}
          stories={stories}
          initialIndex={activeStoryIndex}
          onStoryDeleted={loadStories}
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
