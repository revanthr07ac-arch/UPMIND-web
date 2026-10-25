import React, { useState } from 'react';
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
} from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { formatTimeAgo, formatNumber } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Post } from '../../types/database';

interface PostCardProps {
  post: Post;
  onRequestMaterials: (post: Post) => void;
  onOpenComments: (post: Post) => void;
  onOpenShare: (post: Post) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onRequestMaterials,
  onOpenComments,
  onOpenShare,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isLiked, setIsLiked] = useState<boolean>(!!post.is_liked);
  const [likesCount, setLikesCount] = useState<number>(post.likes_count || 0);
  const [isSaved, setIsSaved] = useState<boolean>(!!post.is_saved);
  const [showTutorialDetails, setShowTutorialDetails] = useState<boolean>(false);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [showOptions, setShowOptions] = useState<boolean>(false);

  const author = post.author;
  const isSelf = user?.id === post.author_id;

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
    <article className="w-full bg-[#15161B] border border-[#292B34] rounded-[16px] overflow-hidden mb-5 transition-shadow hover:shadow-card select-none">
      {/* Header */}
      <header className="flex items-center justify-between p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={author?.avatar_url}
            name={author?.full_name || author?.username}
            size="md"
            hasStory={true}
            onClick={() => author?.username && navigate(`/u/${author.username}`)}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span
                onClick={() => author?.username && navigate(`/u/${author.username}`)}
                className="text-sm font-semibold text-[#F5F5F7] hover:underline cursor-pointer"
              >
                {author?.username || 'creator'}
              </span>
              {!isSelf && (
                <>
                  <span className="text-[#858995] text-xs">•</span>
                  <button
                    onClick={handleFollow}
                    className="text-xs font-semibold text-[#E5484D] hover:text-[#FF7479] transition-colors"
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </>
              )}
            </div>
            <span className="text-[11px] text-[#858995]">{formatTimeAgo(post.created_at)}</span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowOptions(!showOptions)}
            aria-label="Post options"
            className="text-[#858995] hover:text-[#F5F5F7] p-1.5 rounded-[8px] hover:bg-[#1B1D24] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showOptions && (
            <div className="absolute right-0 top-8 z-20 w-36 bg-[#1B1D24] border border-[#292B34] rounded-[12px] shadow-xl py-1 animate-fade-in text-xs">
              <button
                onClick={() => {
                  onOpenShare(post);
                  setShowOptions(false);
                }}
                className="w-full text-left px-3 py-2 text-[#B0B3BD] hover:text-white hover:bg-[#282A32]"
              >
                Share Link
              </button>
              {!isSelf && (
                <button
                  onClick={() => {
                    alert('Post reported for review.');
                    setShowOptions(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[#FF6269] hover:bg-[#FF6269]/10"
                >
                  Report Post
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Media Preview */}
      {(post.image_url || post.video_url) && (
        <div className="relative w-full aspect-square sm:aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
          {post.video_url || post.post_type === 'reel' ? (
            <video
              src={post.video_url || post.image_url || ''}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={post.image_url!}
              alt={post.caption}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.01]"
            />
          )}

          {/* Tutorial badge overlay */}
          {post.post_type === 'tutorial' && (
            <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-[8px] border border-white/10 flex items-center gap-1.5 text-xs font-semibold text-[#F5F5F7]">
              <BookOpen className="w-3.5 h-3.5 text-[#E5484D]" />
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
              className="flex items-center gap-1.5 text-sm font-semibold transition-transform active:scale-90"
            >
              <Heart
                className={`w-6 h-6 transition-colors ${
                  isLiked
                    ? 'fill-[#E5484D] text-[#E5484D]'
                    : 'text-[#B0B3BD] hover:text-[#F5F5F7]'
                }`}
              />
              <span className={isLiked ? 'text-[#E5484D]' : 'text-[#B0B3BD]'}>
                {formatNumber(likesCount)}
              </span>
            </button>

            {/* Comment Button */}
            <button
              onClick={() => onOpenComments(post)}
              aria-label="View comments"
              className="flex items-center gap-1.5 text-sm font-semibold text-[#B0B3BD] hover:text-[#F5F5F7] transition-colors"
            >
              <MessageCircle className="w-6 h-6" />
              <span>{formatNumber(post.comments_count)}</span>
            </button>

            {/* Share Button */}
            <button
              onClick={() => onOpenShare(post)}
              aria-label="Share post"
              className="text-[#B0B3BD] hover:text-[#F5F5F7] transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Request Learning Materials Button (Core differentiator) */}
            {!isSelf && (
              <button
                onClick={() => onRequestMaterials(post)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#E5484D]/15 hover:bg-[#E5484D]/25 active:bg-[#E5484D]/35 text-[#E5484D] border border-[#E5484D]/40 text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Request Materials</span>
              </button>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              aria-label={isSaved ? 'Remove from saved' : 'Save post'}
              className="text-[#B0B3BD] hover:text-[#F5F5F7] p-1 transition-colors"
            >
              <Bookmark
                className={`w-5 h-5 ${
                  isSaved ? 'fill-white text-white' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Caption */}
        <div className="text-sm text-[#F5F5F7] leading-relaxed mb-2">
          <span
            onClick={() => author?.username && navigate(`/u/${author.username}`)}
            className="font-semibold text-white mr-2 hover:underline cursor-pointer"
          >
            {author?.username}
          </span>
          <span>{post.caption}</span>
        </div>

        {/* Skill Tags */}
        {post.skill_tags && post.skill_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {post.skill_tags.map((tag) => (
              <span
                key={tag}
                onClick={() => navigate(`/explore?skill=${encodeURIComponent(tag.replace('#', ''))}`)}
                className="text-xs text-[#E5484D] hover:underline cursor-pointer"
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* Tutorial Breakdown Collapsible */}
        {post.educational_description && (
          <div className="mt-2.5 pt-2.5 border-t border-[#292B34]/60">
            <button
              onClick={() => setShowTutorialDetails(!showTutorialDetails)}
              className="flex items-center justify-between w-full text-xs font-semibold text-[#B0B3BD] hover:text-[#F5F5F7]"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#E5484D]" />
                View Educational Breakdown
              </span>
              {showTutorialDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showTutorialDetails && (
              <div className="mt-2 p-3 rounded-[10px] bg-[#1B1D24] text-xs text-[#B0B3BD] whitespace-pre-wrap leading-relaxed animate-fade-in border border-[#292B34]">
                {post.educational_description}
              </div>
            )}
          </div>
        )}

        {/* View all comments shortcut */}
        {post.comments_count > 0 && (
          <button
            onClick={() => onOpenComments(post)}
            className="text-xs text-[#858995] hover:text-[#B0B3BD] mt-2 block"
          >
            View all {post.comments_count} comments
          </button>
        )}
      </div>
    </article>
  );
};
