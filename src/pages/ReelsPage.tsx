import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  GraduationCap,
  Volume2,
  VolumeX,
  Play,
  ChevronUp,
  ChevronDown,
  Film,
  Plus,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { LearningRequestModal } from '../components/learning/LearningRequestModal';
import { PostCommentsModal } from '../components/feed/PostCommentsModal';
import { ShareModal } from '../components/feed/ShareModal';
import { formatNumber, isReelPost } from '../lib/utils';
import type { Post } from '../types/database';

export const ReelsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Reels feed state
  const [reels, setReels] = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Video playback state
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [videoError, setVideoError] = useState<boolean>(false);

  // Engagement maps
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likesCountMap, setLikesCountMap] = useState<Record<string, number>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [commentsCountMap, setCommentsCountMap] = useState<Record<string, number>>({});
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  // Modals
  const [selectedPostForMaterials, setSelectedPostForMaterials] = useState<Post | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);

  // Touch swipe tracking
  const touchStartY = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load real published reels from Supabase
  const loadReels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setVideoError(false);

    try {
      // 1. Query Supabase for posts with author details
      // First attempt: try with full migration 012 schema
      let queryResult = await supabase
        .from('posts')
        .select('*, author:author_id(*)')
        .or('post_type.eq.reel,post_type.eq.video,is_reel.eq.true,video_url.not.is.null')
        .order('created_at', { ascending: false })
        .limit(30);

      // If columns do not exist in DB yet (e.g. video_url or is_reel column missing, error code 42703),
      // query all posts and filter client-side with full schema resilience
      if (
        queryResult.error &&
        (queryResult.error.code === '42703' ||
          queryResult.error.message?.includes('does not exist'))
      ) {
        queryResult = await supabase
          .from('posts')
          .select('*, author:author_id(*)')
          .order('created_at', { ascending: false })
          .limit(30);
      }

      if (queryResult.error) {
        throw queryResult.error;
      }

      const rawPosts = (queryResult.data as any[]) || [];

      // 2. Fetch blocked users if authenticated to respect safety rules
      const blockedUserIds = new Set<string>();
      if (user) {
        try {
          const { data: blocks } = await supabase
            .from('blocks')
            .select('blocker_id, blocked_id')
            .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
          if (blocks) {
            blocks.forEach((b: any) => {
              if (b.blocker_id === user.id) blockedUserIds.add(b.blocked_id);
              if (b.blocked_id === user.id) blockedUserIds.add(b.blocker_id);
            });
          }
        } catch (_) {
          // Non-critical; RLS also enforces blocks
        }
      }

      // 3. Filter strictly for published reels that have valid video media
      const validReels: Post[] = rawPosts
        .filter((post: any) => {
          // Exclude blocked users
          if (post.author_id && blockedUserIds.has(post.author_id)) {
            return false;
          }

          // Exclude unauthorized private posts
          if (post.visibility === 'private' && (!user || post.author_id !== user.id)) {
            return false;
          }

          // Must be explicitly published as reel and have valid video media
          return isReelPost(post);
        })
        .map((post: any) => ({
          ...post,
          video_url: post.video_url || post.image_url,
        }));

      setReels(validReels);
      setCurrentIndex(0);

      // 4. Initialize interaction maps from real backend data
      if (validReels.length > 0) {
        const initialLikesMap: Record<string, number> = {};
        const initialCommentsMap: Record<string, number> = {};
        validReels.forEach((r) => {
          initialLikesMap[r.id] = r.likes_count || 0;
          initialCommentsMap[r.id] = r.comments_count || 0;
        });
        setLikesCountMap(initialLikesMap);
        setCommentsCountMap(initialCommentsMap);

        // If authenticated, fetch user's like, save, and follow states
        if (user) {
          const reelIds = validReels.map((r) => r.id);
          const authorIds = Array.from(
            new Set(validReels.map((r) => r.author_id).filter(Boolean))
          );

          // User likes
          const { data: userLikes } = await supabase
            .from('likes')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', reelIds);

          if (userLikes) {
            const lMap: Record<string, boolean> = {};
            userLikes.forEach((l: any) => {
              lMap[l.post_id] = true;
            });
            setLikedMap(lMap);
          }

          // User saved posts
          const { data: userSaves } = await supabase
            .from('saved_posts')
            .select('post_id')
            .eq('user_id', user.id)
            .in('post_id', reelIds);

          if (userSaves) {
            const sMap: Record<string, boolean> = {};
            userSaves.forEach((s: any) => {
              sMap[s.post_id] = true;
            });
            setSavedMap(sMap);
          }

          // User follows
          if (authorIds.length > 0) {
            const { data: userFollows } = await supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', user.id)
              .in('following_id', authorIds);

            if (userFollows) {
              const fMap: Record<string, boolean> = {};
              userFollows.forEach((f: any) => {
                fMap[f.following_id] = true;
              });
              setFollowingMap(fMap);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Reels load error:', err);
      setError(
        err.message || 'Unable to load reels from the server. Please check your connection.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial load & feed refresh listener
  useEffect(() => {
    loadReels();

    const handleFeedRefresh = () => {
      loadReels();
    };

    window.addEventListener('upmind:refreshFeed', handleFeedRefresh);
    return () => window.removeEventListener('upmind:refreshFeed', handleFeedRefresh);
  }, [loadReels]);

  const currentReel = reels[currentIndex];

  // Reset video error when switching reel
  useEffect(() => {
    setVideoError(false);
  }, [currentIndex]);

  // Handle video play/pause
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {
          setIsPlaying(false);
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [currentIndex, isPlaying]);

  // Vertical navigation handlers
  const handleNext = useCallback(() => {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsPlaying(true);
      setVideoError(false);
    }
  }, [currentIndex, reels.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsPlaying(true);
      setVideoError(false);
    }
  }, [currentIndex]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  // Keyboard navigation
  useEffect(() => {
    const isModalOpen =
      !!selectedPostForMaterials ||
      !!selectedPostForComments ||
      !!selectedPostForShare;

    if (isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleNext,
    handlePrev,
    togglePlay,
    selectedPostForMaterials,
    selectedPostForComments,
    selectedPostForShare,
  ]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;

    // Minimum swipe threshold of 50px
    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
    touchStartY.current = null;
  };

  // Create Reel button handler
  const handleCreateReel = () => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    window.dispatchEvent(
      new CustomEvent('upmind:openCreatePost', {
        detail: { defaultType: 'reel' },
      })
    );
  };

  // Interactive Social Actions with optimistic updates & rollback
  const handleLike = async () => {
    if (!currentReel) return;
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    const reelId = currentReel.id;
    const isCurrentlyLiked = !!likedMap[reelId];
    const currentLikes = likesCountMap[reelId] ?? currentReel.likes_count ?? 0;

    // Optimistic UI update
    setLikedMap((prev) => ({ ...prev, [reelId]: !isCurrentlyLiked }));
    setLikesCountMap((prev) => ({
      ...prev,
      [reelId]: isCurrentlyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1,
    }));

    try {
      if (!isCurrentlyLiked) {
        await supabase.from('likes').insert({ user_id: user.id, post_id: reelId });

        if (currentReel.author_id !== user.id) {
          await supabase.from('notifications').insert({
            recipient_id: currentReel.author_id,
            actor_id: user.id,
            type: 'like',
            related_entity_id: reelId,
          });
        }
      } else {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', reelId);
      }
    } catch (_) {
      // Revert on error
      setLikedMap((prev) => ({ ...prev, [reelId]: isCurrentlyLiked }));
      setLikesCountMap((prev) => ({ ...prev, [reelId]: currentLikes }));
    }
  };

  const handleSave = async () => {
    if (!currentReel) return;
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    const reelId = currentReel.id;
    const isCurrentlySaved = !!savedMap[reelId];

    // Optimistic UI update
    setSavedMap((prev) => ({ ...prev, [reelId]: !isCurrentlySaved }));

    try {
      if (!isCurrentlySaved) {
        await supabase.from('saved_posts').insert({ user_id: user.id, post_id: reelId });
      } else {
        await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', reelId);
      }
    } catch (_) {
      setSavedMap((prev) => ({ ...prev, [reelId]: isCurrentlySaved }));
    }
  };

  const handleFollow = async () => {
    if (!currentReel?.author_id) return;
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    const authorId = currentReel.author_id;
    if (authorId === user.id) return; // Cannot follow yourself

    const isCurrentlyFollowing = !!followingMap[authorId];
    setFollowingMap((prev) => ({ ...prev, [authorId]: !isCurrentlyFollowing }));

    try {
      if (!isCurrentlyFollowing) {
        await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: authorId,
        });

        await supabase.from('notifications').insert({
          recipient_id: authorId,
          actor_id: user.id,
          type: 'follow',
        });
      } else {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', authorId);
      }
    } catch (_) {
      setFollowingMap((prev) => ({ ...prev, [authorId]: isCurrentlyFollowing }));
    }
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-6 select-none">
        <div className="relative w-full max-w-[420px] h-[78vh] sm:h-[82vh] bg-[#15161B] rounded-[24px] overflow-hidden border border-[#292B34] shadow-2xl flex flex-col items-center justify-center gap-3 animate-pulse">
          <div className="w-9 h-9 border-2 border-[#E5484D] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-[#858995] tracking-wider uppercase">
            Loading Reels...
          </span>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="w-full flex items-center justify-center py-12 select-none">
        <div className="w-full max-w-md bg-[#15161B] border border-[#292B34] rounded-[20px] p-8 text-center flex flex-col items-center shadow-xl">
          <div className="w-14 h-14 rounded-full bg-[#32191D] border border-[#E5484D]/30 flex items-center justify-center text-[#FF6269] mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-[#F5F5F7] mb-2">Unable to load reels</h2>
          <p className="text-xs text-[#858995] mb-6 max-w-sm leading-relaxed">{error}</p>
          <button
            onClick={() => loadReels()}
            className="inline-flex items-center gap-2 bg-[#E5484D] hover:bg-[#D7373F] active:bg-[#BE3038] text-white text-xs font-semibold px-5 py-2.5 rounded-[12px] shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Clean Empty State (When no eligible reels exist in DB)
  if (!currentReel || reels.length === 0) {
    return (
      <div className="w-full flex items-center justify-center py-12 sm:py-16 select-none">
        <div className="w-full max-w-md bg-[#101116] border border-dashed border-[#292B34] rounded-[24px] p-8 sm:p-10 text-center flex flex-col items-center shadow-2xl animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-[#1B1D24] border border-[#292B34] flex items-center justify-center text-[#E5484D] mb-4 shadow-md">
            <Film className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#F5F5F7] mb-2 tracking-tight">
            No reels yet
          </h2>
          <p className="text-xs sm:text-sm text-[#858995] mb-6 max-w-sm leading-relaxed">
            Be the first to share a skill, tutorial, or creative moment with the Upmind community.
          </p>
          <button
            onClick={handleCreateReel}
            className="inline-flex items-center gap-2 bg-[#E5484D] hover:bg-[#D7373F] active:bg-[#BE3038] text-white text-sm font-semibold px-6 py-3 rounded-[12px] shadow-lg shadow-[#E5484D]/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create a Reel</span>
          </button>
        </div>
      </div>
    );
  }

  const isLiked = !!likedMap[currentReel.id];
  const likesCount = likesCountMap[currentReel.id] ?? currentReel.likes_count ?? 0;
  const isSaved = !!savedMap[currentReel.id];
  const commentsCount = commentsCountMap[currentReel.id] ?? currentReel.comments_count ?? 0;
  const isAuthorFollowing = !!(currentReel.author_id && followingMap[currentReel.author_id]);
  const isOwnReel = user?.id === currentReel.author_id;

  return (
    <div className="w-full flex items-center justify-center py-2 select-none">
      {/* Reel Phone Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full max-w-[420px] h-[78vh] sm:h-[82vh] bg-black rounded-[24px] overflow-hidden border border-[#292B34] shadow-2xl flex flex-col justify-between"
      >
        {/* Video Player Area */}
        <div
          className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black"
          onClick={togglePlay}
        >
          {currentReel.video_url && !videoError ? (
            <video
              ref={videoRef}
              src={currentReel.video_url}
              loop
              muted={isMuted}
              autoPlay
              playsInline
              onError={() => {
                setVideoError(true);
              }}
              onLoadedData={() => {
                setVideoError(false);
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Video unavailable fallback card */
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#101116] text-[#858995]">
              <div className="w-12 h-12 rounded-full bg-[#1B1D24] border border-[#292B34] flex items-center justify-center text-[#FF7479] mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-[#F5F5F7] mb-1">
                Video unavailable
              </span>
              <span className="text-xs text-[#858995] max-w-xs mb-4">
                This media file could not be played or is temporarily inaccessible.
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setVideoError(false);
                  if (videoRef.current) {
                    videoRef.current.load();
                  }
                }}
                className="px-3.5 py-1.5 rounded-[8px] bg-[#1B1D24] hover:bg-[#282A32] text-xs font-medium text-white border border-[#292B34] transition-colors"
              >
                Reload Video
              </button>
            </div>
          )}

          {/* Pause Indicator Overlay */}
          {!isPlaying && !videoError && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white">
                <Play className="w-8 h-8 ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Top Controls Overlay */}
        <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              Reels
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
            </span>
            {reels.length > 1 && (
              <span className="text-[11px] font-semibold text-white/60 bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                {currentIndex + 1} of {reels.length}
              </span>
            )}
          </div>

          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/80 backdrop-blur-xs transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Right Floating Actions Bar */}
        <div className="absolute right-3 bottom-20 z-30 flex flex-col items-center gap-4 text-white">
          {/* Like */}
          <button
            onClick={handleLike}
            aria-label="Like"
            className="flex flex-col items-center gap-1 active:scale-90 transition-transform cursor-pointer"
          >
            <div className="p-2.5 rounded-full bg-black/50 backdrop-blur-xs hover:bg-black/70 transition-colors">
              <Heart
                className={`w-6 h-6 transition-colors ${
                  isLiked ? 'fill-[#E5484D] text-[#E5484D]' : 'text-white'
                }`}
              />
            </div>
            <span className="text-[11px] font-semibold drop-shadow">{formatNumber(likesCount)}</span>
          </button>

          {/* Comments */}
          <button
            onClick={() => setSelectedPostForComments(currentReel)}
            aria-label="Comments"
            className="flex flex-col items-center gap-1 active:scale-90 transition-transform cursor-pointer"
          >
            <div className="p-2.5 rounded-full bg-black/50 backdrop-blur-xs hover:bg-black/70 transition-colors">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-[11px] font-semibold drop-shadow">
              {formatNumber(commentsCount)}
            </span>
          </button>

          {/* Request Learning Materials */}
          <button
            onClick={() => setSelectedPostForMaterials(currentReel)}
            title="Request Learning Materials"
            aria-label="Request Learning Materials"
            className="flex flex-col items-center gap-1 active:scale-90 transition-transform cursor-pointer"
          >
            <div className="p-2.5 rounded-full bg-[#E5484D] text-white shadow-lg shadow-[#E5484D]/30 hover:bg-[#D7373F] transition-colors">
              <GraduationCap className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-[#E5484D] bg-black/70 px-1 rounded drop-shadow">
              Materials
            </span>
          </button>

          {/* Bookmark */}
          <button
            onClick={handleSave}
            aria-label="Save"
            className="p-2.5 rounded-full bg-black/50 backdrop-blur-xs hover:bg-black/70 active:scale-90 transition-transform cursor-pointer"
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-white text-white' : 'text-white'}`} />
          </button>

          {/* Share */}
          <button
            onClick={() => setSelectedPostForShare(currentReel)}
            aria-label="Share"
            className="p-2.5 rounded-full bg-black/50 backdrop-blur-xs hover:bg-black/70 active:scale-90 transition-transform cursor-pointer"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Bottom Details Overlay */}
        <div className="relative z-20 p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-2">
          {/* Creator Header */}
          <div className="flex items-center gap-2.5">
            <div
              className="cursor-pointer flex items-center gap-2"
              onClick={() => {
                if (currentReel.author?.username) {
                  navigate(`/u/${currentReel.author.username}`);
                }
              }}
            >
              <Avatar
                src={currentReel.author?.avatar_url}
                name={currentReel.author?.username || currentReel.author?.full_name}
                size="sm"
              />
              <span className="text-sm font-bold text-white drop-shadow hover:underline">
                @{currentReel.author?.username || 'creator'}
              </span>
            </div>

            {/* Follow button (hidden for creator's own reels) */}
            {!isOwnReel && currentReel.author_id && (
              <button
                onClick={handleFollow}
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-[6px] transition-colors cursor-pointer ${
                  isAuthorFollowing
                    ? 'bg-white/20 text-white/90 hover:bg-[#32191D] hover:text-[#FF6269] hover:border-[#E5484D] border border-transparent'
                    : 'bg-[#E5484D] hover:bg-[#D7373F] text-white shadow-xs'
                }`}
              >
                {isAuthorFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {/* Caption */}
          {currentReel.caption && (
            <p className="text-xs text-white/90 line-clamp-3 leading-relaxed drop-shadow font-normal">
              {currentReel.caption}
            </p>
          )}

          {/* Educational Note (if attached) */}
          {currentReel.educational_description && (
            <p className="text-[11px] text-[#B0B3BD] line-clamp-2 bg-black/40 backdrop-blur-xs px-2 py-1 rounded-[6px] border border-white/5">
              💡 {currentReel.educational_description}
            </p>
          )}

          {/* Skill tags */}
          {currentReel.skill_tags && currentReel.skill_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {currentReel.skill_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] font-semibold text-[#FF7479] drop-shadow"
                >
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Vertical Next / Prev arrows */}
        <div className="hidden md:flex flex-col gap-2 absolute -right-14 top-1/2 -translate-y-1/2 z-30">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            title="Previous Reel (Up Arrow)"
            aria-label="Previous Reel"
            className="p-2.5 rounded-full bg-[#15161B] border border-[#292B34] text-white hover:bg-[#1B1D24] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-lg"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === reels.length - 1}
            title="Next Reel (Down Arrow)"
            aria-label="Next Reel"
            className="p-2.5 rounded-full bg-[#15161B] border border-[#292B34] text-white hover:bg-[#1B1D24] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-lg"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Learning Request Modal */}
      <LearningRequestModal
        isOpen={!!selectedPostForMaterials}
        onClose={() => setSelectedPostForMaterials(null)}
        post={selectedPostForMaterials}
      />

      {/* Comments Modal */}
      <PostCommentsModal
        isOpen={!!selectedPostForComments}
        onClose={() => setSelectedPostForComments(null)}
        post={selectedPostForComments}
        onCommentAdded={() => {
          if (currentReel) {
            setCommentsCountMap((prev) => ({
              ...prev,
              [currentReel.id]: (prev[currentReel.id] ?? currentReel.comments_count ?? 0) + 1,
            }));
          }
        }}
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
