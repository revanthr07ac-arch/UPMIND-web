import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { Avatar } from '../common/Avatar';
import { formatTimeAgo } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Post, Comment, Profile } from '../../types/database';

interface PostCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  onCommentAdded?: () => void;
}

export const PostCommentsModal: React.FC<PostCommentsModalProps> = ({
  isOpen,
  onClose,
  post,
  onCommentAdded,
}) => {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !post) return;

    async function loadComments() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('comments')
          .select('*, author:author_id(*)')
          .eq('post_id', post!.id)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setComments(data as Comment[]);
        }
      } catch (_) {
      } finally {
        setIsLoading(false);
      }
    }

    loadComments();
  }, [isOpen, post]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post || !newComment.trim()) return;

    setIsSubmitting(true);
    const commentContent = newComment.trim();

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: post.id,
          author_id: user.id,
          content: commentContent,
        })
        .select('*, author:author_id(*)')
        .single();

      if (!error && data) {
        setComments((prev) => [...prev, data as Comment]);
        setNewComment('');

        // Notify post author if not self
        if (post.author_id !== user.id) {
          await supabase.from('notifications').insert({
            recipient_id: post.author_id,
            actor_id: user.id,
            type: 'comment',
            related_entity_id: post.id,
          });
        }

        onCommentAdded?.();
      }
    } catch (_) {
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!post) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Comments" maxWidth="md">
      <div className="flex flex-col h-[450px]">
        {/* Comments list */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Post Author Caption as first item */}
          <div className="flex items-start gap-3 pb-3 border-b border-[#292B34]/60">
            <Avatar
              src={post.author?.avatar_url}
              name={post.author?.full_name || post.author?.username}
              size="sm"
            />
            <div className="flex flex-col min-w-0">
              <div className="text-xs text-[#F5F5F7]">
                <strong className="mr-1.5">{post.author?.username}</strong>
                <span>{post.caption}</span>
              </div>
              <span className="text-[10px] text-[#858995] mt-1">
                {formatTimeAgo(post.created_at)}
              </span>
            </div>
          </div>

          {/* Comment items */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="text-xs text-[#858995]">Loading comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-xs font-medium text-[#F5F5F7]">No comments yet</p>
              <p className="text-[11px] text-[#858995] mt-1">Be the first to start the discussion!</p>
            </div>
          ) : (
            comments.map((comment) => {
              const author = (comment.author as Profile) || null;
              return (
                <div key={comment.id} className="flex items-start gap-3">
                  <Avatar
                    src={author?.avatar_url}
                    name={author?.full_name || author?.username}
                    size="sm"
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="text-xs text-[#F5F5F7] leading-relaxed">
                      <strong className="mr-1.5 text-white">{author?.username || 'member'}</strong>
                      <span>{comment.content}</span>
                    </div>
                    <span className="text-[10px] text-[#858995] mt-1">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Comment input form */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 pt-3 border-t border-[#292B34] mt-2"
        >
          <Avatar
            src={profile?.avatar_url}
            name={profile?.full_name || profile?.username}
            size="xs"
          />
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-[#1B1D24] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[10px] border border-[#292B34] px-3 py-2 focus:border-[#FF7479] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="p-2 text-[#E5484D] hover:text-[#FF7479] disabled:opacity-40 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </Dialog>
  );
};
