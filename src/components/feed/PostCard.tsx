import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  GraduationCap,
  MoreHorizontal,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { formatTimeAgo, formatNumber } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { EditPostModal } from './EditPostModal';
import { DeletePostModal } from './DeletePostModal';
import type { Post } from '../../types/database';

interface PostCardProps {
  post: Post;
  onRequestMaterials: (post: Post) => void;
  onOpenComments: (post: Post) => void;
  onOpenShare: (post: Post) => void;
  onPostDeleted?: (postId: string) => void;
  onPostUpdated?: (updatedPost: Post) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onRequestMaterials,
  onOpenComments,
  onOpenShare,
  onPostDeleted,
  onPostUpdated,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentPost, setCurrentPost] = useState<Post>(post);
  const [isLiked, setIsLiked] = useState<boolean>(!!post.is_liked);
  const [likesCount, setLikesCount] = useState<number>(post.likes_count || 0);
  const [isSaved, setIsSaved] = useState<boolean>(!!post.is_saved);
  const [showTutorialDetails, setShowTutorialDetails] = useState<boolean>(false);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  useEffect(() => {
    setCurrentPost(post);
    setIsLiked(!!post.is_liked);
    setLikesCount(post.likes_count || 0);
    setIsSaved(!!post.is_saved);
  }, [post]);

  const author = currentPost.author;
  // Strict ownership rule: compare authenticated user ID with post owner ID
  const isSelf = !!user?.id && user.id === currentPost.author_id;

  const handleLike = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikesCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      if (nextLiked) {
        await supabase.from('likes').insert({
          user_id: user.id,
          post_id: post.id,
        });

        if (post.author_id !== user.id) {
          await supabase.from('notifications').insert({
            recipient_id: post.author_id,
            actor_id: user.id,
            type: 'like',
            related_entity_id: post.id,
          });
        }
      } else {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', post.id);
      }
    } catch (_) {
      // Revert on failure
      setIsLiked(!nextLiked);
      setLikesCount((prev) => (nextLiked ? Math.max(0, prev - 1) : prev + 1));
    }
  };

  const handleSave = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    try {
      if (nextSaved) {
        await supabase.from('saved_posts').insert({
          user_id: user.id,
          post_id: post.id,
        });
      } else {
        await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', post.id);
      }
    } catch (_) {
      setIsSaved(!nextSaved);
    }
  };

  const handleFollow = async () => {
    if (!user || isSelf) return;
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);

    try {
      if (nextFollowing) {
        await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: post.author_id,
        });
        await supabase.from('notifications').insert({
          recipient_id: post.author_id,
          actor_id: user.id,
          type: 'follow',
        });
      } else {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', post.author_id);
      }
    } catch (_) {
      setIsFollowing(!nextFollowing);
    }
  };

  return (
    <article className="w-full bg-surface border border-theme rounded-[16px] overflow-hidden mb-5 transition-shadow hover:shadow-card select-none">
      {/* Header */}
      <header className="flex items-center justify-between p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={author?.avatar_url}
            name={author?.full_name || author?.username}
            size="md"
            onClick={() => author?.username && navigate(`/u/${author.username}`)}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span
                onClick={() => author?.username && navigate(`/u/${author.username}`)}
                className="text-sm font-semibold text-primary hover:underline cursor-pointer"
              >
                {author?.username || 'creator'}
              </span>
              {!isSelf && (
                <>
                  <span className="text-muted text-xs">•</span>
                  <button
                    onClick={handleFollow}
                    className="text-xs font-semibold text-[#FF304F] hover:text-[#FF7479] transition-colors cursor-pointer"
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </>
              )}
            </div>
            <span className="text-[11px] text-muted">{formatTimeAgo(currentPost.created_at)}</span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowOptions(!showOptions)}
            aria-label="Post options"
            className="text-muted hover:text-primary p-1.5 rounded-[8px] hover:bg-surface-secondary transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showOptions && (
            <div className="absolute right-0 top-8 z-20 w-40 bg-surface border border-theme rounded-[12px] shadow-elevated py-1 animate-fade-in text-xs overflow-hidden">
              {isSelf ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditModalOpen(true);
                      setShowOptions(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-secondary hover:text-primary hover:bg-surface-secondary cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#FF304F]" />
                    <span>Edit Post</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsDeleteModalOpen(true);
                      setShowOptions(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-[#FF6269] hover:bg-[#FF6269]/10 cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Post</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenShare(currentPost);
                      setShowOptions(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-secondary hover:text-primary hover:bg-surface-secondary cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 text-muted" />
                    <span>Share Link</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      onOpenShare(currentPost);
                      setShowOptions(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-secondary hover:text-primary hover:bg-surface-secondary cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 text-muted" />
                    <span>Share Link</span>
                  </button>
                  <button
                    onClick={() => {
                      alert('Post reported for review.');
                      setShowOptions(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-[#FF6269] hover:bg-[#FF6269]/10 cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <span>Report Post</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Media Preview */}
      {(currentPost.image_url || currentPost.video_url) && (
        <div className="relative w-full aspect-square sm:aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
          {currentPost.video_url || currentPost.post_type === 'reel' ? (
            <video
              src={currentPost.video_url || currentPost.image_url || ''}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={currentPost.image_url!}
              alt={currentPost.caption}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.01]"
            />
          )}

          {/* Tutorial badge overlay */}
          {currentPost.post_type === 'tutorial' && (
            <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-[8px] border border-white/10 flex items-center gap-1.5 text-xs font-semibold text-white">
              <BookOpen className="w-3.5 h-3.5 text-[#FF304F]" />
              <span>Tutorial Breakdown</span>
            </div>
          )}
        </div>
      )}

      {/* Social Actions Bar */}
      <div className="p-3.5 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Like Button */}
            <button
              onClick={handleLike}
              aria-label={isLiked ? 'Unlike' : 'Like'}
              className="flex items-center gap-1.5 text-sm font-semibold transition-transform active:scale-90 cursor-pointer"
            >
              <Heart
                className={`w-6 h-6 transition-colors ${
                  isLiked
                    ? 'fill-[#FF304F] text-[#FF304F]'
                    : 'text-secondary hover:text-primary'
                }`}
              />
              <span className={isLiked ? 'text-[#FF304F]' : 'text-secondary'}>
                {formatNumber(likesCount)}
              </span>
            </button>

            {/* Comment Button */}
            <button
              onClick={() => onOpenComments(currentPost)}
              aria-label="View comments"
              className="flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-primary transition-colors cursor-pointer"
            >
              <MessageCircle className="w-6 h-6" />
              <span>{formatNumber(currentPost.comments_count)}</span>
            </button>

            {/* Share Button */}
            <button
              onClick={() => onOpenShare(currentPost)}
              aria-label="Share post"
              className="text-secondary hover:text-primary transition-colors cursor-pointer"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Request Learning Materials Button (Core differentiator) */}
            {!isSelf && (
              <button
                onClick={() => onRequestMaterials(currentPost)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#FF304F]/10 hover:bg-[#FF304F]/20 active:bg-[#FF304F]/30 text-[#FF304F] border border-[#FF304F]/30 text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Request Materials</span>
              </button>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              aria-label={isSaved ? 'Remove from saved' : 'Save post'}
              className="text-secondary hover:text-primary p-1 transition-colors cursor-pointer"
            >
              <Bookmark
                className={`w-5 h-5 ${
                  isSaved ? 'fill-[#FF304F] text-[#FF304F]' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Caption */}
        <div className="text-sm text-primary leading-relaxed mb-2">
          <span
            onClick={() => author?.username && navigate(`/u/${author.username}`)}
            className="font-bold text-primary mr-2 hover:underline cursor-pointer"
          >
            {author?.username}
          </span>
          <span>{currentPost.caption}</span>
        </div>

        {/* Skill Tags */}
        {currentPost.skill_tags && currentPost.skill_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {currentPost.skill_tags.map((tag) => (
              <span
                key={tag}
                onClick={() => navigate(`/explore?skill=${encodeURIComponent(tag.replace('#', ''))}`)}
                className="text-xs text-[#FF304F] hover:underline cursor-pointer font-medium"
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Tutorial Breakdown Collapsible */}
        {currentPost.educational_description && (
          <div className="mt-2.5 pt-2.5 border-t border-theme">
            <button
              onClick={() => setShowTutorialDetails(!showTutorialDetails)}
              className="flex items-center justify-between w-full text-xs font-semibold text-secondary hover:text-primary cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#FF304F]" />
                View Educational Breakdown
              </span>
              {showTutorialDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showTutorialDetails && (
              <div className="mt-2 p-3 rounded-[10px] bg-surface-secondary text-xs text-secondary whitespace-pre-wrap leading-relaxed animate-fade-in border border-theme">
                {currentPost.educational_description}
              </div>
            )}
          </div>
        )}

        {/* View all comments shortcut */}
        {currentPost.comments_count > 0 && (
          <button
            onClick={() => onOpenComments(currentPost)}
            className="text-xs text-muted hover:text-secondary mt-2 block cursor-pointer"
          >
            View all {currentPost.comments_count} comments
          </button>
        )}
      </div>

      {/* Edit Post Modal */}
      <EditPostModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        post={currentPost}
        onPostUpdated={(updated) => {
          setCurrentPost(updated);
          onPostUpdated?.(updated);
        }}
      />

      {/* Delete Post Modal */}
      <DeletePostModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        post={currentPost}
        onPostDeleted={(id) => {
          onPostDeleted?.(id);
        }}
      />
    </article>
  );
};
