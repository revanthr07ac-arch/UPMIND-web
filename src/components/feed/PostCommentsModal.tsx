import React, { useEffect, useState } from 'react';
import { Send, Edit3, Trash2 } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { Avatar } from '../common/Avatar';
import { formatTimeAgo } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { EditPostModal } from './EditPostModal';
import { DeletePostModal } from './DeletePostModal';
import type { Post, Comment, Profile } from '../../types/database';

interface PostCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  onCommentAdded?: () => void;
  onPostUpdated?: (updated: Post) => void;
  onPostDeleted?: (postId: string) => void;
}

export const PostCommentsModal: React.FC<PostCommentsModalProps> = ({
  isOpen,
  onClose,
  post,
  onCommentAdded,
  onPostUpdated,
  onPostDeleted,
}) => {
  const { user, profile } = useAuth();
  const [currentPost, setCurrentPost] = useState<Post | null>(post);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    setCurrentPost(post);
  }, [post]);

  useEffect(() => {
    if (!isOpen || !currentPost) return;

    async function loadComments() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('comments')
          .select('*, author:author_id(*)')
          .eq('post_id', currentPost!.id)
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
  }, [isOpen, currentPost]);

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

  if (!currentPost) return null;

  const isOwner = !!user?.id && user.id === currentPost.author_id;

  return (
    <>
      <Dialog isOpen={isOpen} onClose={onClose} title="Comments" maxWidth="md">
        <div className="flex flex-col h-[450px]">
          {/* Comments list */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Post Author Caption as first item */}
            <div className="flex items-start gap-3 pb-3 border-b border-theme">
              <Avatar
                src={currentPost.author?.avatar_url}
                name={currentPost.author?.full_name || currentPost.author?.username}
                size="sm"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="text-xs text-primary">
                  <strong className="mr-1.5">{currentPost.author?.username}</strong>
                  <span>{currentPost.caption}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-muted">
                    {formatTimeAgo(currentPost.created_at)}
                  </span>
                  {isOwner && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditModalOpen(true)}
                        className="text-[11px] font-semibold text-[#FF304F] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <span className="text-muted text-[10px]">•</span>
                      <button
                        type="button"
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="text-[11px] font-semibold text-[#FF6269] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Comment items */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <span className="text-xs text-muted">Loading comments...</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-xs font-medium text-primary">No comments yet</p>
                <p className="text-[11px] text-muted mt-1">Be the first to start the discussion!</p>
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
                      <div className="text-xs text-primary leading-relaxed">
                        <strong className="mr-1.5 text-primary">{author?.username || 'member'}</strong>
                        <span>{comment.content}</span>
                      </div>
                      <span className="text-[10px] text-muted mt-1">
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
            className="flex items-center gap-2 pt-3 border-t border-theme mt-2"
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
              className="flex-1 bg-surface-secondary text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme px-3 py-2 focus:border-[#FF304F] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="p-2 rounded-[10px] bg-[#FF304F] hover:bg-[#E5203F] text-white disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </Dialog>

      {/* Edit Modal */}
      {isOwner && (
        <EditPostModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          post={currentPost}
          onPostUpdated={(updated) => {
            setCurrentPost(updated);
            onPostUpdated?.(updated);
          }}
        />
      )}

      {/* Delete Modal */}
      {isOwner && (
        <DeletePostModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          post={currentPost}
          onPostDeleted={(id) => {
            onPostDeleted?.(id);
            onClose();
          }}
        />
      )}
    </>
  );
};
