import React, { useEffect, useState, useRef } from 'react';
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
} from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { LearningRequestModal } from '../components/learning/LearningRequestModal';
import { PostCommentsModal } from '../components/feed/PostCommentsModal';
import { ShareModal } from '../components/feed/ShareModal';
import { formatNumber } from '../lib/utils';
import type { Post } from '../types/database';

export const ReelsPage: React.FC = () => {
  const { user } = useAuth();
  const [reels, setReels] = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Engagement states
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likesCountMap, setLikesCountMap] = useState<Record<string, number>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});

  // Modals
  const [selectedPostForMaterials, setSelectedPostForMaterials] = useState<Post | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    async function loadReels() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*, author:author_id(*)')
          .or('post_type.eq.reel,video_url.not.is.null')
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data && data.length > 0) {
          setReels(data as Post[]);
        } else {
          // If no reel posts uploaded yet, fetch any post with media or fallback to high quality demo tutorial reels
          const { data: allPosts } = await supabase
            .from('posts')
            .select('*, author:author_id(*)')
            .limit(5);

          const sampleVideos = [
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
          ];

          const demoReels: Post[] = (allPosts && allPosts.length > 0 ? allPosts : [1, 2, 3]).map(
            (p: any, idx: number) => ({
              id: typeof p === 'object' ? p.id : `reel-${idx}`,
              author_id: typeof p === 'object' ? p.author_id : 'demo-user',
              caption:
                typeof p === 'object' && p.caption
                  ? p.caption
                  : 'Fast UI animation breakdown with 60fps springs! #UIUX #DesignTutorial',
              image_url: null,
              video_url: sampleVideos[idx % sampleVideos.length],
              post_type: 'reel',
              is_reel: true,
              educational_description: 'Key principles: damping ratio, mass, stiffness parameters.',
              skill_tags: ['#UI/UX Design', '#Animation', '#PeerLearning'],
              visibility: 'public',
              likes_count: 24 + idx * 12,
              comments_count: 5 + idx * 3,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              author: typeof p === 'object' && p.author ? p.author : {
                id: 'demo-user',
                username: `creator_${idx + 1}`,
                full_name: `Mentor ${idx + 1}`,
                avatar_url: null,
                bio: 'Designing modern interactive experiences.',
                location: null,
                interests: [],
                experience_level: 'advanced',
                portfolio_links: [],
                followers_count: 140,
                following_count: 20,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            })
          );
          setReels(demoReels);
        }
      } catch (err) {
        console.error('Reels load error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadReels();
  }, [user]);

  const currentReel = reels[currentIndex];

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

  const handleNext = () => {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  const handleLike = async () => {
    if (!currentReel) return;
    const reelId = currentReel.id;
    const isCurrentlyLiked = !!likedMap[reelId];
    const currentLikes = likesCountMap[reelId] ?? currentReel.likes_count;

    setLikedMap((prev) => ({ ...prev, [reelId]: !isCurrentlyLiked }));
    setLikesCountMap((prev) => ({
      ...prev,
      [reelId]: isCurrentlyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1,
    }));

    if (user) {
      try {
        if (!isCurrentlyLiked) {
          await supabase.from('likes').insert({ user_id: user.id, post_id: reelId });
        } else {
          await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', reelId);
        }
      } catch (_) {}
    }
  };

  const handleSave = async () => {
    if (!currentReel) return;
    const reelId = currentReel.id;
    const isCurrentlySaved = !!savedMap[reelId];
    setSavedMap((prev) => ({ ...prev, [reelId]: !isCurrentlySaved }));

    if (user) {
      try {
        if (!isCurrentlySaved) {
          await supabase.from('saved_posts').insert({ user_id: user.id, post_id: reelId });
        } else {
          await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', reelId);
        }
      } catch (_) {}
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 border-2 border-[#E5484D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentReel) {
    return (
      <div className="py-20 text-center text-xs text-[#858995]">
        No reels available right now. Be the first to create one!
      </div>
    );
  }

  const isLiked = !!likedMap[currentReel.id];
  const likesCount = likesCountMap[currentReel.id] ?? currentReel.likes_count;
  const isSaved = !!savedMap[currentReel.id];

  return (
    <div className="w-full flex items-center justify-center py-2 select-none">
      {/* Reel Phone Container */}
      <div className="relative w-full max-w-[400px] h-[78vh] sm:h-[82vh] bg-black rounded-[22px] overflow-hidden border border-[#292B34] shadow-2xl flex flex-col justify-between">
        {/* Video Player */}
        <div
          className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black"
          onClick={togglePlay}
        >
          <video
            ref={videoRef}
            src={currentReel.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'}
            loop
            muted={isMuted}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {!isPlaying && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white">
                <Play className="w-8 h-8 ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* Top Controls Overlay */}
        <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
          <span className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
            Reels
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
          </span>

          <button
            onClick={toggleMute}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Right Floating Actions Bar */}
        <div className="absolute right-3 bottom-20 z-30 flex flex-col items-center gap-4 text-white">
          {/* Like */}
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
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
            className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          >
            <div className="p-2.5 rounded-full bg-black/50 backdrop-blur-xs hover:bg-black/70 transition-colors">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-[11px] font-semibold drop-shadow">
              {formatNumber(currentReel.comments_count)}
            </span>
          </button>

          {/* Request Learning Materials */}
          <button
            onClick={() => setSelectedPostForMaterials(currentReel)}
            title="Request Learning Materials"
            className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
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
            className="p-2.5 rounded-full bg-black/50 backdrop-blur-xs hover:bg-black/70 active:scale-90 transition-transform"
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-white text-white' : 'text-white'}`} />
          </button>

          {/* Share */}
          <button
            onClick={() => setSelectedPostForShare(currentReel)}
            className="p-2.5 rounded-full bg-black/50 backdrop-blur-xs hover:bg-black/70 active:scale-90 transition-transform"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Bottom Details Overlay */}
        <div className="relative z-20 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2">
          {/* Creator Header */}
          <div className="flex items-center gap-2.5">
            <Avatar
              src={currentReel.author?.avatar_url}
              name={currentReel.author?.username}
              size="sm"
            />
            <span className="text-sm font-bold text-white drop-shadow">
              @{currentReel.author?.username || 'creator'}
            </span>
            <button className="text-xs font-semibold px-2.5 py-0.5 rounded-[6px] bg-white/20 hover:bg-white/30 text-white backdrop-blur-xs transition-colors">
              Follow
            </button>
          </div>

          {/* Caption */}
          <p className="text-xs text-white/90 line-clamp-2 leading-relaxed drop-shadow">
            {currentReel.caption}
          </p>

          {/* Skill tags */}
          {currentReel.skill_tags && currentReel.skill_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {currentReel.skill_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] font-medium text-[#FF7479] drop-shadow"
                >
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Vertical Next / Prev arrows */}
        <div className="hidden md:flex flex-col gap-2 absolute -right-14 top-1/2 -translate-y-1/2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-2.5 rounded-full bg-[#15161B] border border-[#292B34] text-white hover:bg-[#1B1D24] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === reels.length - 1}
            className="p-2.5 rounded-full bg-[#15161B] border border-[#292B34] text-white hover:bg-[#1B1D24] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
