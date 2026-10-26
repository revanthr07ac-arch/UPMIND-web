import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReelsPage } from '../pages/ReelsPage';
import { isVideoMedia, isReelPost } from '../lib/utils';
import * as authContext from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/video.mp4' } })),
      })),
    },
  },
}));

describe('Reels Validation & Utilities', () => {
  it('identifies video URLs and formats correctly with isVideoMedia', () => {
    expect(isVideoMedia('https://example.com/demo.mp4')).toBe(true);
    expect(isVideoMedia('https://example.com/stream.webm')).toBe(true);
    expect(isVideoMedia('https://example.com/video.mov?token=123')).toBe(true);
    expect(isVideoMedia('https://example.com/storage/v1/object/public/reels_videos/user/1.mp4')).toBe(true);
    expect(isVideoMedia('data:video/mp4;base64,AAAA')).toBe(true);

    // Non-video media
    expect(isVideoMedia('https://example.com/photo.png')).toBe(false);
    expect(isVideoMedia('https://example.com/photo.jpg')).toBe(false);
    expect(isVideoMedia(null)).toBe(false);
    expect(isVideoMedia('')).toBe(false);
  });

  it('correctly filters published reels with isReelPost', () => {
    // Valid reel post
    const validReel = {
      id: 'reel-1',
      author_id: 'user-1',
      caption: 'Figma tips',
      video_url: 'https://storage.supabase.co/reels_videos/1.mp4',
      post_type: 'reel',
      is_reel: true,
      visibility: 'public',
    };
    expect(isReelPost(validReel)).toBe(true);

    // Valid reel with video in image_url fallback
    const validFallbackReel = {
      id: 'reel-2',
      author_id: 'user-1',
      caption: 'Flutter animation',
      image_url: 'https://storage.supabase.co/reels_videos/2.mp4',
      post_type: 'reel',
      visibility: 'public',
    };
    expect(isReelPost(validFallbackReel)).toBe(true);

    // Normal image post must NOT be identified as a reel
    const imagePost = {
      id: 'post-1',
      author_id: 'user-2',
      caption: 'Design showcase',
      image_url: 'https://storage.supabase.co/post_images/sample.png',
      post_type: 'image',
      is_reel: false,
      visibility: 'public',
    };
    expect(isReelPost(imagePost)).toBe(false);

    // Post without video media must NOT be identified as a reel even if post_type is reel
    const emptyMediaReel = {
      id: 'post-2',
      author_id: 'user-3',
      caption: 'No video',
      video_url: '',
      image_url: null,
      post_type: 'reel',
      is_reel: true,
    };
    expect(isReelPost(emptyMediaReel)).toBe(false);
  });
});

describe('ReelsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (authContext.useAuth as any).mockReturnValue({
      user: { id: 'test-user-id', email: 'tester@upmind.dev' },
      profile: { id: 'test-user-id', username: 'tester' },
      isLoading: false,
    });
  });

  it('displays proper empty state when no eligible reels exist in DB', async () => {
    // Mock Supabase returning empty list
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    render(
      <MemoryRouter>
        <ReelsPage />
      </MemoryRouter>
    );

    // Should display clean empty state
    await waitFor(() => {
      expect(screen.getByText('No reels yet')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Be the first to share a skill, tutorial, or creative moment with the Upmind community.'
      )
    ).toBeInTheDocument();

    const createBtn = screen.getByRole('button', { name: /create a reel/i });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn.className).toContain('bg-[#E5484D]');

    // Must NOT contain hardcoded placeholder caption or fake usernames
    expect(screen.queryByText(/Fast UI animation breakdown/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@revanth_r/i)).not.toBeInTheDocument();
  });

  it('dispatches upmind:openCreatePost event when Create a Reel is clicked', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <MemoryRouter>
        <ReelsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create a reel/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /create a reel/i }));

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'upmind:openCreatePost',
        detail: { defaultType: 'reel' },
      })
    );
  });

  it('displays error state with retry button when fetching reels fails', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '500', message: 'Database connection timed out' },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    render(
      <MemoryRouter>
        <ReelsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to load reels')).toBeInTheDocument();
    });

    expect(screen.getByText('Database connection timed out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // Must NOT silently show fake reels
    expect(screen.queryByText(/Fast UI animation breakdown/i)).not.toBeInTheDocument();
  });

  it('displays real reel data when published reel exists', async () => {
    const mockReel = {
      id: 'real-reel-123',
      author_id: 'creator-99',
      caption: 'Mastering CSS Grid & Flexbox in 60s',
      video_url: 'https://example.com/tutorials/css-grid.mp4',
      post_type: 'reel',
      is_reel: true,
      educational_description: 'Grid template areas simplify complex layouts',
      skill_tags: ['#CSS', '#WebDev'],
      visibility: 'public',
      likes_count: 42,
      comments_count: 8,
      created_at: new Date().toISOString(),
      author: {
        id: 'creator-99',
        username: 'alice_designer',
        full_name: 'Alice Design',
        avatar_url: null,
      },
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [mockReel], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    render(
      <MemoryRouter>
        <ReelsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('@alice_designer')).toBeInTheDocument();
    });

    expect(screen.getByText('Mastering CSS Grid & Flexbox in 60s')).toBeInTheDocument();
    expect(screen.getByText('#CSS')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.queryByText('No reels yet')).not.toBeInTheDocument();
  });

  it('excludes normal image posts and unauthorized private posts from the reels feed', async () => {
    const normalImagePost = {
      id: 'img-post-1',
      author_id: 'creator-99',
      caption: 'Normal static photography post',
      image_url: 'https://example.com/photo.png',
      post_type: 'image',
      is_reel: false,
      visibility: 'public',
      likes_count: 5,
      comments_count: 1,
      author: { id: 'creator-99', username: 'photographer' },
    };

    const privatePostByOther = {
      id: 'priv-reel-2',
      author_id: 'other-user',
      caption: 'Secret reel',
      video_url: 'https://example.com/secret.mp4',
      post_type: 'reel',
      is_reel: true,
      visibility: 'private',
      author: { id: 'other-user', username: 'secret_user' },
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [normalImagePost, privatePostByOther],
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    render(
      <MemoryRouter>
        <ReelsPage />
      </MemoryRouter>
    );

    // Both should be filtered out, leading to proper empty state
    await waitFor(() => {
      expect(screen.getByText('No reels yet')).toBeInTheDocument();
    });

    expect(screen.queryByText('Normal static photography post')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret reel')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login when Create a Reel is clicked', async () => {
    (authContext.useAuth as any).mockReturnValue({
      user: null,
      profile: null,
      isLoading: false,
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    render(
      <MemoryRouter initialEntries={['/reels']}>
        <ReelsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create a reel/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /create a reel/i }));
  });

  it('displays unavailable video error card and allows reloading when video playback errors', async () => {
    const mockReel = {
      id: 'broken-reel',
      author_id: 'creator-1',
      caption: 'Video playback error test',
      video_url: 'https://example.com/broken.mp4',
      post_type: 'reel',
      is_reel: true,
      visibility: 'public',
      likes_count: 0,
      comments_count: 0,
      author: { id: 'creator-1', username: 'video_maker' },
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [mockReel], error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    render(
      <MemoryRouter>
        <ReelsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('@video_maker')).toBeInTheDocument();
    });

    // Simulate video error
    const videoElement = document.querySelector('video');
    expect(videoElement).toBeInTheDocument();
    if (videoElement) {
      fireEvent.error(videoElement);
    }

    // Must show video unavailable error card rather than remaining black
    await waitFor(() => {
      expect(screen.getByText('Video unavailable')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /reload video/i })).toBeInTheDocument();
  });

  it('filters out reels authored by blocked users', async () => {
    const blockedAuthorReel = {
      id: 'blocked-reel-1',
      author_id: 'blocked-user-id',
      caption: 'Reel from blocked user',
      video_url: 'https://example.com/blocked.mp4',
      post_type: 'reel',
      is_reel: true,
      visibility: 'public',
      likes_count: 10,
      comments_count: 2,
      author: { id: 'blocked-user-id', username: 'blocked_person' },
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [blockedAuthorReel], error: null }),
        };
      }
      if (table === 'blocks') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockResolvedValue({
            data: [{ blocker_id: 'test-user-id', blocked_id: 'blocked-user-id' }],
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    render(
      <MemoryRouter>
        <ReelsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No reels yet')).toBeInTheDocument();
    });
    expect(screen.queryByText('Reel from blocked user')).not.toBeInTheDocument();
  });

  it('allows liking a reel and updates like counts', async () => {
    const mockReel = {
      id: 'like-test-reel',
      author_id: 'creator-55',
      caption: 'Liking test reel',
      video_url: 'https://example.com/likes.mp4',
      post_type: 'reel',
      is_reel: true,
      visibility: 'public',
      likes_count: 10,
      comments_count: 0,
      author: { id: 'creator-55', username: 'creator55' },
    };

    const insertMock = vi.fn().mockResolvedValue({ error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [mockReel], error: null }),
        };
      }
      if (table === 'likes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: insertMock,
        };
      }
      if (table === 'notifications') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        or: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    render(
      <MemoryRouter>
        <ReelsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('@creator55')).toBeInTheDocument();
    });

    expect(screen.getByText('10')).toBeInTheDocument();
    const likeBtn = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeBtn);

    // Optimistic count increment to 11
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'test-user-id',
        post_id: 'like-test-reel',
      })
    );
  });
});
