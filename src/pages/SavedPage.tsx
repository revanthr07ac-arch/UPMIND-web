import React, { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { PostCard } from '../components/feed/PostCard';
import { LearningRequestModal } from '../components/learning/LearningRequestModal';
import { PostCommentsModal } from '../components/feed/PostCommentsModal';
import { ShareModal } from '../components/feed/ShareModal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Post } from '../types/database';

export const SavedPage: React.FC = () => {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedPostForMaterials, setSelectedPostForMaterials] = useState<Post | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);

  const loadSavedPosts = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_posts')
        .select('*, post:post_id(*, author:author_id(*))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const postsList = data.map((d) => ({
          ...d.post,
          is_saved: true,
        })).filter(Boolean) as Post[];
        setSavedPosts(postsList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSavedPosts();
  }, [user]);

  return (
    <div className="w-full flex flex-col gap-5 select-none">
      <div className="flex items-center gap-2.5 pb-3 border-b border-[#292B34]">
        <div className="w-8 h-8 rounded-[10px] bg-[#15161B] border border-[#292B34] flex items-center justify-center text-[#E5484D]">
          <Bookmark className="w-4 h-4" />
        </div>
        <h1 className="text-xl font-bold text-[#F5F5F7]">Saved Collections</h1>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-[#858995]">Loading bookmarks...</div>
      ) : savedPosts.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="w-6 h-6 text-[#858995]" />}
          title="No saved tutorials yet"
          description="Bookmark posts you want to study later or references you want to practice. Only you can see your saved posts."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {savedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onRequestMaterials={(p) => setSelectedPostForMaterials(p)}
              onOpenComments={(p) => setSelectedPostForComments(p)}
              onOpenShare={(p) => setSelectedPostForShare(p)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <LearningRequestModal
        isOpen={!!selectedPostForMaterials}
        onClose={() => setSelectedPostForMaterials(null)}
        post={selectedPostForMaterials}
      />
      <PostCommentsModal
        isOpen={!!selectedPostForComments}
        onClose={() => setSelectedPostForComments(null)}
        post={selectedPostForComments}
      />
      <ShareModal
        isOpen={!!selectedPostForShare}
        onClose={() => setSelectedPostForShare(null)}
        post={selectedPostForShare}
      />
    </div>
  );
};
