import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { formatTimeAgo } from '../../lib/utils';
import type { Story } from '../../types/database';

interface StoryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  stories: Story[];
  initialIndex?: number;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  onClose,
  stories,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
  }, [initialIndex, isOpen]);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (!isOpen || !currentStory || isPaused) return;

    const DURATION_MS = 5000;
    const INTERVAL_MS = 50;
    const step = (INTERVAL_MS / DURATION_MS) * 100;

    timerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Advance to next story or close
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((idx) => idx + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, currentStory, currentIndex, stories.length, isPaused, onClose]);

  if (!isOpen || !currentStory) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center select-none"
      onClick={onClose}
    >
      {/* Story View Container */}
      <div
        className="relative w-full max-w-sm sm:max-w-md h-[90vh] max-h-[750px] bg-[#15161B] rounded-[20px] overflow-hidden border border-[#292B34] flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Progress Bars */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
          {stories.map((story, idx) => (
            <div
              key={story.id}
              className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-75 ease-linear"
                style={{
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Story Header */}
        <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between text-white drop-shadow">
          <div className="flex items-center gap-2.5">
            <Avatar
              src={currentStory.author?.avatar_url}
              name={currentStory.author?.username}
              size="sm"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold">{currentStory.author?.username}</span>
              <span className="text-[10px] text-white/80">
                {formatTimeAgo(currentStory.created_at)}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Media Background */}
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {currentStory.media_type === 'video' ? (
            <video
              src={currentStory.media_url}
              autoPlay
              playsInline
              loop
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={currentStory.media_url}
              alt="Story"
              className="w-full h-full object-cover"
            />
          )}

          {/* Touch / Click zones for Previous & Next */}
          <div
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer z-20"
            onClick={handlePrev}
          />
          <div
            className="absolute inset-y-0 right-0 w-1/3 cursor-pointer z-20"
            onClick={handleNext}
          />
        </div>

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-4 left-3 right-3 z-30 p-3 bg-black/70 backdrop-blur-xs rounded-[12px] border border-white/10 text-xs text-white text-center leading-relaxed">
            {currentStory.caption}
          </div>
        )}

        {/* Desktop Previous / Next Buttons */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="hidden sm:flex absolute -left-12 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[#1B1D24] text-white hover:bg-[#282A32] border border-[#292B34]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {currentIndex < stories.length - 1 && (
          <button
            onClick={handleNext}
            className="hidden sm:flex absolute -right-12 top-1/2 -translate-y-1/2 p-2 rounded-full bg-[#1B1D24] text-white hover:bg-[#282A32] border border-[#292B34]"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
