import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { deleteUserPost } from '../../lib/postActions';
import type { Post } from '../../types/database';

interface DeletePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  onPostDeleted?: (postId: string) => void;
}

export const DeletePostModal: React.FC<DeletePostModalProps> = ({
  isOpen,
  onClose,
  post,
  onPostDeleted,
}) => {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!post) return null;

  const handleDelete = async () => {
    if (!user) {
      setError('You must be signed in to delete this post.');
      return;
    }

    // Verify ownership
    if (user.id !== post.author_id) {
      setError('You can only delete your own posts.');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteUserPost(
        post.id,
        user.id,
        post.image_url,
        post.video_url
      );

      if (!result.success) {
        setError(result.error || 'Failed to delete post. Please try again.');
        setIsDeleting(false);
        return;
      }

      // Notify caller & listeners
      onPostDeleted?.(post.id);

      window.dispatchEvent(
        new CustomEvent('upmind:postDeleted', {
          detail: { postId: post.id },
        })
      );
      window.dispatchEvent(new CustomEvent('upmind:refreshFeed'));

      onClose();
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message || 'An unexpected error occurred while deleting.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={isDeleting ? () => {} : onClose} title="Delete Post" maxWidth="sm">
      <div className="flex flex-col gap-4 p-1">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#FF6269]/15 text-[#FF6269] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-primary">
              Delete this post permanently?
            </p>
            <p className="text-xs text-secondary leading-relaxed">
              Are you sure you want to delete this post? This action cannot be undone and all associated media will be removed.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-[10px] bg-[#FF6269]/10 border border-[#FF6269]/30 text-xs text-[#FF6269]">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-theme mt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            Delete Post
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

