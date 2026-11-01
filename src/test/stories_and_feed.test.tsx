import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StoriesBar } from '../components/feed/StoriesBar';
import { StoryViewerModal } from '../components/feed/StoryViewerModal';
import { HomePage } from '../pages/HomePage';
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
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/media.jpg' } })),
      })),
    },
  },
}));

describe('Stories & Feed — Real User Content Only', () => {
  const mockUser = {
    id: 'user-real-1',
    email: 'creator@upmind.dev',
  };

  const mockProfile = {
    id: 'user-real-1',
    username: 'alex_rivers',
    full_name: 'Alex Rivers',
    avatar_url: 'https://storage.supabase.co/avatars/alex.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (authContext.useAuth as any).mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      isLoading: false,
    });
  });

  describe('StoriesBar Component', () => {
    it('displays clean honest empty state ("No stories yet", "Add Your Story") when database has no stories', async () => {
      // Mock Supabase returning empty list for stories
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'stories') {
          return {
            select: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      render(
        <MemoryRouter>
          <StoriesBar />
        </MemoryRouter>
      );

      // Clean empty state must be present
      await waitFor(() => {
        expect(screen.getByText('No stories yet')).toBeInTheDocument();
      });

      const addBtn = screen.getByRole('button', { name: /add your story/i });
      expect(addBtn).toBeInTheDocument();

      // Must NOT contain fake fallback stories
      expect(screen.queryByText(/UI\/UX practice work/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/coding practice work/i)).not.toBeInTheDocument();
    });

    it('opens story composer when "Add Your Story" is clicked', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'stories') {
          return {
            select: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      render(
        <MemoryRouter>
          <StoriesBar />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No stories yet')).toBeInTheDocument();
      });

      const addBtn = screen.getByRole('button', { name: /add your story/i });
      fireEvent.click(addBtn);

      // Dialog title from StoryComposerModal should now appear
      expect(screen.getByText('Add to Story (24hr)')).toBeInTheDocument();
    });

    it('displays real published stories from other creators', async () => {
      const realStory = {
        id: 'story-real-99',
        user_id: 'user-real-2',
        media_url: 'https://storage.supabase.co/stories/real_design.png',
        media_type: 'image',
        caption: 'Building real design tokens',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        author: {
          id: 'user-real-2',
          username: 'sarah_codes',
          avatar_url: 'https://storage.supabase.co/avatars/sarah.png',
        },
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'stories') {
          return {
            select: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [realStory], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      render(
        <MemoryRouter>
          <StoriesBar />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('sarah_codes')).toBeInTheDocument();
      });

      // "No stories yet" badge should not appear when stories exist
      expect(screen.queryByText('No stories yet')).not.toBeInTheDocument();
    });
  });

  describe('StoryViewerModal Component', () => {
    it('shows delete story button for story owner and calls supabase delete', async () => {
      const myStory = {
        id: 'story-mine-1',
        user_id: mockUser.id,
        media_url: 'https://storage.supabase.co/stories/mine.jpg',
        media_type: 'image' as const,
        caption: 'My real daily work',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        author: mockProfile,
      };

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'stories') {
          return {
            delete: mockDelete,
          };
        }
        return {};
      });

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onStoryDeletedMock = vi.fn();
      const onCloseMock = vi.fn();

      render(
        <StoryViewerModal
          isOpen={true}
          onClose={onCloseMock}
          stories={[myStory as any]}
          initialIndex={0}
          onStoryDeleted={onStoryDeletedMock}
        />
      );

      // Verify Delete button is visible
      const deleteBtn = screen.getByRole('button', { name: /delete story/i });
      expect(deleteBtn).toBeInTheDocument();

      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled();
        expect(onStoryDeletedMock).toHaveBeenCalledWith('story-mine-1');
        expect(onCloseMock).toHaveBeenCalled();
      });
    });

    it('does NOT show delete button when viewing another user’s story', () => {
      const otherStory = {
        id: 'story-other-1',
        user_id: 'someone-else-id',
        media_url: 'https://storage.supabase.co/stories/other.jpg',
        media_type: 'image' as const,
        caption: 'Another creator update',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        author: {
          id: 'someone-else-id',
          username: 'jane_doe',
          avatar_url: null,
        },
      };

      render(
        <StoryViewerModal
          isOpen={true}
          onClose={vi.fn()}
          stories={[otherStory as any]}
          initialIndex={0}
        />
      );

      expect(screen.queryByRole('button', { name: /delete story/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close story/i })).toBeInTheDocument();
    });
  });

  describe('HomePage Feed Component', () => {
    it('displays clean honest empty state ("No posts yet", "Create Your First Post") when database has no posts', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'stories') {
          return {
            select: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No posts yet')).toBeInTheDocument();
      });

      const createBtn = screen.getByRole('button', { name: /create your first post/i });
      expect(createBtn).toBeInTheDocument();
    });

    it('dispatches upmind:openCreatePost when "Create Your First Post" button is clicked', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'stories') {
          return {
            select: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'posts') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No posts yet')).toBeInTheDocument();
      });

      const createBtn = screen.getByRole('button', { name: /create your first post/i });
      fireEvent.click(createBtn);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'upmind:openCreatePost' })
      );
    });
  });
});
