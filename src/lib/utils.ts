import confetti from 'canvas-confetti';

export function formatTimeAgo(dateString: string): string {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toString();
}

export function getInitials(name?: string | null, fallback: string = 'U'): string {
  if (!name) return fallback.toUpperCase();
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function triggerLearningCelebration() {
  try {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#E5484D', '#FF7479', '#35B883', '#F5F5F7'],
    });
  } catch (_) {}
}

export function truncate(text: string, maxLen: number = 100): string {
  if (!text || text.length <= maxLen) return text || '';
  return text.substring(0, maxLen) + '...';
}

export function isVideoMedia(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.toLowerCase().split('?')[0];
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv'];
  if (videoExtensions.some((ext) => cleanUrl.endsWith(ext))) {
    return true;
  }
  if (cleanUrl.includes('/reels_videos/')) {
    return true;
  }
  if (url.startsWith('data:video/')) {
    return true;
  }
  return false;
}

export function isReelPost(post: any): boolean {
  if (!post || typeof post !== 'object') return false;

  // Must have valid video media
  const video = post.video_url || (isVideoMedia(post.image_url) ? post.image_url : null);
  if (!video || typeof video !== 'string' || video.trim() === '') {
    return false;
  }

  // Check explicit reel indicators
  if (post.is_reel === true || post.post_type === 'reel' || post.post_type === 'video') {
    return true;
  }

  // Check skill tags for #reel or #shortvideo
  const tags = Array.isArray(post.skill_tags)
    ? post.skill_tags.map((t: string) => (typeof t === 'string' ? t.toLowerCase() : ''))
    : [];
  if (tags.some((t: string) => t.includes('reel') || t.includes('shortvideo'))) {
    return true;
  }

  return false;
}

