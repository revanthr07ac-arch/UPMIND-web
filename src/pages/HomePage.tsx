import React, { useEffect, useState, useCallback } from 'react';
import { StoriesBar } from '../components/feed/StoriesBar';
import { PostCard } from '../components/feed/PostCard';
import { PostSkeleton, EmptyState } from '../components/common/EmptyState';
import { LearningRequestModal } from '../components/learning/LearningRequestModal';
import { PostCommentsModal } from '../components/feed/PostCommentsModal';
import { ShareModal } from '../components/feed/ShareModal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Sparkles, Users, RefreshCw } from 'lucide-react';
import type { Post } from '../types/database';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [feedTab, setFeedTab] = useState<'forYou' | 'following'>('forYou');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modals state
  const [selectedPostForMaterials, setSelectedPostForMaterials] = useState<Post | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);

  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      let query = supabase
        .from('posts')
        .select('*, author:author_id(*)')
        .order('created_at', { ascending: false })
        .limit(20);

      // If 'Following' tab is active, filter by followed creators
      if (feedTab === 'following' && user) {
        const { data: followings } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        const ids = followings?.map((f) => f.following_id) || [];
        if (ids.length > 0) {
          query = query.in('author_id', ids);
        } else {
          setPosts([]);
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        // If user logged in, fetch liked and saved state
        if (user && data.length > 0) {
          const postIds = data.map((p) => p.id);
          const [likesRes, savesRes] = await Promise.all([
            supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
            supabase.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          ]);

          const likedMap = new Set(likesRes.data?.map((l) => l.post_id) || []);
          const savedMap = new Set(savesRes.data?.map((s) => s.post_id) || []);

          const enhanced = data.map((p) => ({
            ...p,
            is_liked: likedMap.has(p.id),
            is_saved: savedMap.has(p.id),
          })) as Post[];

          setPosts(enhanced);
        } else {
          setPosts(data as Post[]);
        }
      }
    } catch (err) {
      console.error('Feed error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [feedTab, user]);

  useEffect(() => {
    fetchPosts();

    const handleFeedRefresh = () => fetchPosts(true);
    window.addEventListener('upmind:refreshFeed', handleFeedRefresh);
    return () => window.removeEventListener('upmind:refreshFeed', handleFeedRefresh);
  }, [fetchPosts]);

  return (
    <div className="w-full flex flex-col">
      {/* Stories Bar */}
      <StoriesBar />

      {/* Feed Filter Tabs */}
      <div className="flex items-center justify-between border-b border-[#292B34] pb-2 mb-4">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setFeedTab('forYou')}
            className={`flex items-center gap-2 pb-2 text-sm font-semibold transition-colors relative ${
              feedTab === 'forYou' ? 'text-[#F5F5F7]' : 'text-[#858995] hover:text-[#B0B3BD]'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#E5484D]" />
            <span>For You</span>
            {feedTab === 'forYou' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E5484D] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setFeedTab('following')}
            className={`flex items-center gap-2 pb-2 text-sm font-semibold transition-colors relative ${
              feedTab === 'following' ? 'text-[#F5F5F7]' : 'text-[#858995] hover:text-[#B0B3BD]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Following</span>
            {feedTab === 'following' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E5484D] rounded-full" />
            )}
          </button>
        </div>

        <button
          onClick={() => fetchPosts(true)}
          disabled={isRefreshing}
          aria-label="Refresh feed"
          className="text-[#858995] hover:text-[#F5F5F7] p-1.5 rounded-[8px] hover:bg-[#15161B] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#E5484D]' : ''}`} />
        </button>
      </div>

      {/* Posts Feed */}
      <div className="w-full flex flex-col">
        {isLoading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length === 0 ? (
          <EmptyState
            title={feedTab === 'following' ? 'No posts from creators you follow yet' : 'Your feed is just getting started'}
            description={
              feedTab === 'following'
                ? 'Follow creators in the Explore tab or suggested creators to see their tutorials and portfolios here.'
                : 'Publish a skill showcase or tutorial post to kick off the community learning feed!'
            }
          />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onRequestMaterials={(p) => setSelectedPostForMaterials(p)}
              onOpenComments={(p) => setSelectedPostForComments(p)}
              onOpenShare={(p) => setSelectedPostForShare(p)}
            />
          ))
        )}
      </div>

      {/* Learning Request Modal */}
      <LearningRequestModal
        isOpen={!!selectedPostForMaterials}
        onClose={() => setSelectedPostForMaterials(null)}
        post={selectedPostForMaterials}
      />

      {/* Comments Drawer / Modal */}
      <PostCommentsModal
        isOpen={!!selectedPostForComments}
        onClose={() => setSelectedPostForComments(null)}
        post={selectedPostForComments}
        onCommentAdded={() => fetchPosts(true)}
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
