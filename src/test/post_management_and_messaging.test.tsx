import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PostCard } from '../components/feed/PostCard';
import { DeletePostModal } from '../components/feed/DeletePostModal';
import { EditPostModal } from '../components/feed/EditPostModal';
import { MessagesPage } from '../pages/MessagesPage';
import { extractUserStoragePath, deleteUserPost } from '../lib/postActions';
import { getOrCreateDirectConversation } from '../lib/conversations';
import * as authContext from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Post } from '../types/database';

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
        upload: vi.fn().mockResolvedValue({ data: { path: 'user-1/file.jpg' }, error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://storage.supabase.co/post_images/user-1/file.jpg' } })),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

describe('Post Management & One-to-One Messaging Tests', () => {
  const mockUserA = {
    id: 'user-aaa-111',
    email: 'userA@upmind.test',
  };

  const mockUserB = {
    id: 'user-bbb-222',
    email: 'userB@upmind.test',
  };

  const mockProfileA = {
    id: 'user-aaa-111',
    username: 'creatorA',
    full_name: 'Creator A',
    avatar_url: null,
  };

  const samplePostA: Post = {
    id: 'post-100',
    author_id: 'user-aaa-111',
    caption: 'Mastering React 19 and Supabase',
    educational_description: 'Here are the key takeaways for state management.',
    skill_tags: ['#React', '#Frontend'],
    post_type: 'image',
    image_url: 'https://test.supabase.co/storage/v1/object/public/post_images/user-aaa-111/photo.jpg',
    video_url: null,
    likes_count: 5,
    comments_count: 2,
    visibility: 'public',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author: mockProfileA as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Part 1 — Post Ownership & Options Menu', () => {
    it('shows Edit Post and Delete Post options when authenticated user owns the post', () => {
      (authContext.useAuth as any).mockReturnValue({
        user: mockUserA,
        profile: mockProfileA,
      });

      render(
        <MemoryRouter>
          <PostCard
            post={samplePostA}
            onRequestMaterials={vi.fn()}
            onOpenComments={vi.fn()}
            onOpenShare={vi.fn()}
          />
        </MemoryRouter>
      );

      const optionsBtn = screen.getByLabelText('Post options');
      fireEvent.click(optionsBtn);

      expect(screen.getByText('Edit Post')).toBeInTheDocument();
      expect(screen.getByText('Delete Post')).toBeInTheDocument();
      expect(screen.getByText('Share Link')).toBeInTheDocument();
      expect(screen.queryByText('Report Post')).not.toBeInTheDocument();
    });

    it('never shows Edit Post or Delete Post to non-owners (User B viewing User A post)', () => {
      (authContext.useAuth as any).mockReturnValue({
        user: mockUserB,
        profile: { id: 'user-bbb-222', username: 'viewerB' },
      });

      render(
        <MemoryRouter>
          <PostCard
            post={samplePostA}
            onRequestMaterials={vi.fn()}
            onOpenComments={vi.fn()}
            onOpenShare={vi.fn()}
          />
        </MemoryRouter>
      );

      const optionsBtn = screen.getByLabelText('Post options');
      fireEvent.click(optionsBtn);

      expect(screen.queryByText('Edit Post')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete Post')).not.toBeInTheDocument();
      expect(screen.getByText('Share Link')).toBeInTheDocument();
      expect(screen.getByText('Report Post')).toBeInTheDocument();
    });

    it('never shows Edit Post or Delete Post to logged-out visitors', () => {
      (authContext.useAuth as any).mockReturnValue({
        user: null,
        profile: null,
      });

      render(
        <MemoryRouter>
          <PostCard
            post={samplePostA}
            onRequestMaterials={vi.fn()}
            onOpenComments={vi.fn()}
            onOpenShare={vi.fn()}
          />
        </MemoryRouter>
      );

      const optionsBtn = screen.getByLabelText('Post options');
      fireEvent.click(optionsBtn);

      expect(screen.queryByText('Edit Post')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete Post')).not.toBeInTheDocument();
    });
  });

  describe('Part 1 — Storage Path Extraction & Safe Media Cleanup', () => {
    it('correctly extracts bucket and path only if user owns the storage object', () => {
      const validUrl = 'https://xyz.supabase.co/storage/v1/object/public/post_images/user-aaa-111/photo.jpg';
      const extracted = extractUserStoragePath(validUrl, 'user-aaa-111');
      expect(extracted).toEqual({
        bucket: 'post_images',
        path: 'user-aaa-111/photo.jpg',
      });
    });

    it('strictly refuses to return a path if the storage URL belongs to a different user (anti-tamper guard)', () => {
      const foreignUrl = 'https://xyz.supabase.co/storage/v1/object/public/post_images/user-other-999/secret.jpg';
      const extracted = extractUserStoragePath(foreignUrl, 'user-aaa-111');
      expect(extracted).toBeNull();
    });

    it('returns null for non-storage external URLs', () => {
      const externalUrl = 'https://images.unsplash.com/photo-1579546929518';
      expect(extractUserStoragePath(externalUrl, 'user-aaa-111')).toBeNull();
    });

    it('deleteUserPost deletes database record scoped to author_id and cleans up owned media', async () => {
      const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: deleteEqMock,
        })),
      }));

      (supabase.from as any).mockReturnValue({
        delete: deleteMock,
      });

      const result = await deleteUserPost(
        'post-100',
        'user-aaa-111',
        'https://xyz.supabase.co/storage/v1/object/public/post_images/user-aaa-111/photo.jpg',
        null
      );

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('posts');
      expect(supabase.storage.from).toHaveBeenCalledWith('post_images');
    });
  });

  describe('Part 1 — DeletePostModal Confirmation', () => {
    it('renders confirmation text and triggers deletion on confirmation', async () => {
      (authContext.useAuth as any).mockReturnValue({
        user: mockUserA,
      });

      const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
      (supabase.from as any).mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: deleteEqMock,
          })),
        })),
      });

      const onDeleted = vi.fn();
      const onClose = vi.fn();

      render(
        <DeletePostModal
          isOpen={true}
          onClose={onClose}
          post={samplePostA}
          onPostDeleted={onDeleted}
        />
      );

      expect(
        screen.getByText(/Are you sure you want to delete this post\? This action cannot be undone/i)
      ).toBeInTheDocument();

      const deleteBtn = screen.getByRole('button', { name: /Delete Post/i });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(onDeleted).toHaveBeenCalledWith('post-100');
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Part 1 — EditPostModal Updates', () => {
    it('loads existing post content and allows updating caption and skill tags', async () => {
      (authContext.useAuth as any).mockReturnValue({
        user: mockUserA,
      });

      const updateEq2Mock = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { ...samplePostA, caption: 'Updated caption for testing' },
            error: null,
          }),
        })),
      }));

      (supabase.from as any).mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: updateEq2Mock,
          })),
        })),
      });

      const onUpdated = vi.fn();
      const onClose = vi.fn();

      render(
        <EditPostModal
          isOpen={true}
          onClose={onClose}
          post={samplePostA}
          onPostUpdated={onUpdated}
        />
      );

      // Verify fields are loaded with existing content
      const captionTextarea = screen.getByDisplayValue('Mastering React 19 and Supabase');
      expect(captionTextarea).toBeInTheDocument();

      // Change caption
      fireEvent.change(captionTextarea, { target: { value: 'Updated caption for testing' } });

      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(onUpdated).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Part 2 — One-to-One Messaging Utility', () => {
    it('rejects creating a conversation with oneself', async () => {
      const result = await getOrCreateDirectConversation('user-1', 'user-1');
      expect(result.conversationId).toBeNull();
      expect(result.error).toContain('yourself');
    });

    it('returns existing conversation if one already exists between the two users', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'conversation_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((col: string, val: string) => {
                if (col === 'user_id' && val === 'user-aaa-111') {
                  return Promise.resolve({
                    data: [{ conversation_id: 'conv-existing-99' }],
                    error: null,
                  });
                }
                if (col === 'user_id' && val === 'user-bbb-222') {
                  return {
                    in: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { conversation_id: 'conv-existing-99' },
                          error: null,
                        }),
                      })),
                    })),
                  };
                }
                return Promise.resolve({ data: [], error: null });
              }),
            })),
          };
        }
        return {};
      });

      const result = await getOrCreateDirectConversation('user-aaa-111', 'user-bbb-222');
      expect(result.conversationId).toBe('conv-existing-99');
    });

    it('creates new conversation using stepwise insertion when no conversation exists', async () => {
      const insertedMembers: any[] = [];
      let convInserted = false;

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'conversation_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
            insert: vi.fn((row: any) => {
              insertedMembers.push(row);
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === 'conversations') {
          return {
            insert: vi.fn(() => {
              convInserted = true;
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      });

      const result = await getOrCreateDirectConversation('user-aaa-111', 'user-bbb-222');
      expect(result.conversationId).toBeTruthy();
      expect(convInserted).toBe(true);
      // Stepwise insert of both members:
      expect(insertedMembers).toHaveLength(2);
      expect(insertedMembers[0].user_id).toBe('user-aaa-111');
      expect(insertedMembers[1].user_id).toBe('user-bbb-222');
    });
  });

  describe('Part 2 & 3 — MessagesPage Component', () => {
    it('displays "No messages yet" with "Discover Creators" CTA when user has no conversations', async () => {
      (authContext.useAuth as any).mockReturnValue({
        user: mockUserA,
        profile: mockProfileA,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'conversation_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          };
        }
        return {};
      });

      render(
        <MemoryRouter>
          <MessagesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No messages yet')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Discover Creators/i })).toBeInTheDocument();
      });
    });

    it('preserves draft input and displays clear error message if message sending fails', async () => {
      (authContext.useAuth as any).mockReturnValue({
        user: mockUserA,
        profile: mockProfileA,
      });

      // Mock conversation found
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'conversation_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((_col1: string, _val1: string) => {
                const chain: any = Promise.resolve({
                  data: [{ conversation_id: 'conv-test-1', user_id: 'user-aaa-111' }],
                  error: null,
                });
                chain.eq = vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'mem-1' },
                      error: null,
                    }),
                  })),
                }));
                return chain;
              }),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          };
        }
        if (table === 'conversations') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'conv-test-1',
                      updated_at: new Date().toISOString(),
                      members: [
                        { user_id: 'user-aaa-111', profile: mockProfileA },
                        { user_id: 'user-bbb-222', profile: { username: 'partnerB' } },
                      ],
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === 'messages') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => {
                  const promise: any = Promise.resolve({ data: [], error: null });
                  promise.limit = vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }));
                  return promise;
                }),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Network connection failed' },
                }),
              })),
            })),
          };
        }
        return {};
      });

      render(
        <MemoryRouter initialEntries={['/messages?conv=conv-test-1']}>
          <MessagesPage />
        </MemoryRouter>
      );

      // Wait for chat to load
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Write a message...')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Write a message...');
      fireEvent.change(input, { target: { value: 'My important draft message' } });

      const sendBtn = screen.getByLabelText('Send message');
      fireEvent.click(sendBtn);

      await waitFor(() => {
        // Error message displayed
        expect(screen.getByText(/Network connection failed/i)).toBeInTheDocument();
        // Draft preserved in input box
        expect(input).toHaveValue('My important draft message');
      });
    });

    it('rejects unauthorized users from opening a private conversation and displays access restriction', async () => {
      (authContext.useAuth as any).mockReturnValue({
        user: { id: 'user-unauthorized-c', email: 'eve@test.com' },
        profile: { id: 'user-unauthorized-c', username: 'eve' },
      });

      // Mock that User C is NOT a member of conv-secret-123
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'conversation_members') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  })),
                })),
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          };
        }
        if (table === 'conversations') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            })),
          };
        }
        return {};
      });

      render(
        <MemoryRouter initialEntries={['/messages?conv=conv-secret-123']}>
          <MessagesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Access denied: You are not an authorized participant in this private conversation/i)
        ).toBeInTheDocument();
      });
    });
  });
});
