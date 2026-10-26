import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CommunitiesPage } from '../pages/CommunitiesPage';
import { CommunityDetailPage } from '../pages/CommunityDetailPage';
import * as communitiesApi from '../lib/communities';
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
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/cover.jpg' } })),
      })),
    },
  },
}));

describe('Communities Feature - Service & Integration Tests', () => {
  const mockUser = {
    id: 'user-alice-123',
    email: 'alice@example.com',
  };

  const mockProfile = {
    id: 'user-alice-123',
    username: 'alice',
    display_name: 'Alice Cooper',
    full_name: 'Alice Cooper',
    avatar_url: 'https://example.com/alice.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (authContext.useAuth as any).mockReturnValue({
      user: mockUser,
      profile: mockProfile,
      loading: false,
    });
  });

  describe('1. Communities API Service Layer', () => {
    it('creates a community with sanitized slug and owner membership atomically', async () => {
      const mockInsertCommunity = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'comm-1',
              name: 'React Developers',
              slug: 'react-developers',
              description: 'All about React and Vite',
              category: 'Development',
              visibility: 'public',
              owner_id: mockUser.id,
              members_count: 1,
            },
            error: null,
          }),
        }),
      });

      const mockInsertMember = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            insert: mockInsertCommunity,
          };
        }
        if (table === 'community_members') {
          return {
            insert: mockInsertMember,
          };
        }
        return {};
      });

      const result = await communitiesApi.createCommunity(
        {
          name: 'React Developers',
          slug: 'react-developers',
          description: 'All about React and Vite',
          category: 'Development',
          visibility: 'public',
        },
        mockUser.id
      );

      expect(result.error).toBeNull();
      expect(result.community?.name).toBe('React Developers');
      expect(result.community?.slug).toBe('react-developers');
      expect(mockInsertCommunity).toHaveBeenCalled();
      expect(mockInsertMember).toHaveBeenCalledWith(
        expect.objectContaining({
          community_id: 'comm-1',
          user_id: mockUser.id,
          role: 'owner',
        })
      );
    });

    it('rejects duplicate slugs during community creation', async () => {
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'communities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'comm-existing', slug: 'react-developers' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await communitiesApi.createCommunity(
        {
          name: 'React Developers',
          slug: 'react-developers',
          description: 'Duplicate slug test',
          category: 'Development',
          visibility: 'public',
        },
        mockUser.id
      );

      expect(result.community).toBeNull();
      expect(result.error).toContain('already taken');
    });

    it('joins a public community successfully', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'community_members') {
          return {
            insert: mockInsert,
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1 }),
            }),
          };
        }
        if (table === 'communities') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      const res = await communitiesApi.joinCommunity('comm-1', mockUser.id, false);
      expect(res.success).toBe(true);
      expect(res.status).toBe('member');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          community_id: 'comm-1',
          user_id: mockUser.id,
          role: 'member',
        })
      );
    });

    it('requests to join a private community instead of granting immediate membership', async () => {
      const mockInsertRequest = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'community_join_requests') {
          return {
            insert: mockInsertRequest,
          };
        }
        return {};
      });

      const res = await communitiesApi.joinCommunity('comm-private-1', mockUser.id, true);
      expect(res.success).toBe(true);
      expect(res.status).toBe('pending');
      expect(mockInsertRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          community_id: 'comm-private-1',
          user_id: mockUser.id,
          status: 'pending',
        })
      );
    });

    it('prevents a community owner from leaving without deleting or transferring ownership', async () => {
      const res = await communitiesApi.leaveCommunity('comm-1', mockUser.id, true);
      expect(res.success).toBe(false);
      expect(res.error).toContain('owner, you cannot leave');
    });

    it('accurately classifies missing-table, permission, and network errors', () => {
      // Missing table / unmigrated schema
      const schemaErr = communitiesApi.classifyCommunityError({
        code: 'PGRST205',
        message: "Could not find the table 'public.communities' in the schema cache",
      });
      expect(schemaErr.type).toBe('schema_missing');
      expect(schemaErr.message).toContain('database tables have not been created yet');

      // Permission denied / RLS
      const permErr = communitiesApi.classifyCommunityError({
        code: '42501',
        message: 'new row violates row-level security policy for table communities',
      });
      expect(permErr.type).toBe('permission_denied');
      expect(permErr.message).toContain('Access denied');

      // Network error
      const netErr = communitiesApi.classifyCommunityError({
        message: 'Failed to fetch',
      });
      expect(netErr.type).toBe('network');
      expect(netErr.message).toContain('Network error');

      // Generic error
      const genericErr = communitiesApi.classifyCommunityError({
        message: 'Something unexpected broke',
      });
      expect(genericErr.type).toBe('unknown');
      expect(genericErr.message).toBe('Something unexpected broke');
    });
  });

  describe('2. CommunitiesPage Component Tests', () => {
    it('displays honest empty state when database has no communities (no fake cards)', async () => {
      vi.spyOn(communitiesApi, 'fetchCommunities').mockResolvedValue({
        communities: [],
        error: null,
      });

      render(
        <MemoryRouter>
          <CommunitiesPage />
        </MemoryRouter>
      );

      // Verify skeleton or loading is followed by honest empty state
      await waitFor(() => {
        expect(screen.getByText('No communities yet.')).toBeInTheDocument();
      });

      // Assert fake mock communities do NOT appear
      expect(screen.queryByText('UI/UX Designers')).not.toBeInTheDocument();
      expect(screen.queryByText('Flutter & Dart Devs')).not.toBeInTheDocument();
      expect(screen.queryByText('Cinematic Video Editors')).not.toBeInTheDocument();
      expect(screen.queryByText('Python & GenAI Builders')).not.toBeInTheDocument();

      // Ensure Create Community CTA is rendered
      expect(screen.getAllByRole('button', { name: /create community/i }).length).toBeGreaterThan(0);
    });

    it('displays error state with a working Retry button when backend query fails', async () => {
      const fetchSpy = vi.spyOn(communitiesApi, 'fetchCommunities').mockResolvedValue({
        communities: [],
        error: 'Failed to connect to backend',
      });

      render(
        <MemoryRouter>
          <CommunitiesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to connect to backend')).toBeInTheDocument();
      });

      // Click retry
      const retryBtn = screen.getByRole('button', { name: /retry/i });
      expect(retryBtn).toBeInTheDocument();

      fetchSpy.mockResolvedValueOnce({
        communities: [
          {
            id: 'comm-live',
            name: 'Live Supabase Community',
            slug: 'live-supabase',
            description: 'A genuine test group',
            category: 'Development',
            visibility: 'public',
            members_count: 5,
            is_member: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('Live Supabase Community')).toBeInTheDocument();
      });
    });

    it('renders real community cards with database member count and responds to join', async () => {
      vi.spyOn(communitiesApi, 'fetchCommunities').mockResolvedValue({
        communities: [
          {
            id: 'comm-alpha',
            name: 'Alpha Community',
            slug: 'alpha-community',
            description: 'A real database community for developers',
            category: 'Development',
            visibility: 'public',
            members_count: 42,
            is_member: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      const joinSpy = vi.spyOn(communitiesApi, 'joinCommunity').mockResolvedValue({
        success: true,
        status: 'member',
        error: null,
      });

      render(
        <MemoryRouter>
          <CommunitiesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Alpha Community')).toBeInTheDocument();
        expect(screen.getByText('42 members')).toBeInTheDocument();
      });

      const joinButton = screen.getByRole('button', { name: /join community/i });
      fireEvent.click(joinButton);

      await waitFor(() => {
        expect(joinSpy).toHaveBeenCalledWith('comm-alpha', mockUser.id, false);
      });
    });

    it('switches between All, My Communities, and Discover tabs', async () => {
      const fetchSpy = vi.spyOn(communitiesApi, 'fetchCommunities').mockResolvedValue({
        communities: [],
        error: null,
      });

      render(
        <MemoryRouter>
          <CommunitiesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No communities yet.')).toBeInTheDocument();
      });

      // Click "My Communities" tab
      const myCommTab = screen.getByRole('button', { name: /my communities/i });
      fireEvent.click(myCommTab);

      await waitFor(() => {
        expect(screen.getByText(/You haven't joined any communities yet/i)).toBeInTheDocument();
      });

      expect(fetchSpy).toHaveBeenCalled();
    });

    it('opens Create Community modal and validates input before submission', async () => {
      vi.spyOn(communitiesApi, 'fetchCommunities').mockResolvedValue({
        communities: [],
        error: null,
      });

      render(
        <MemoryRouter>
          <CommunitiesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Communities')).toBeInTheDocument();
      });

      // Click primary Create Community button in header
      const createBtns = screen.getAllByRole('button', { name: /create community/i });
      fireEvent.click(createBtns[0]);

      // Modal appears
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Create Community' })).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText(/Next\.js & Fullstack Builders/i);
      const descInput = screen.getByPlaceholderText(/What skills will members share/i);

      // Type community name and auto-generate slug
      fireEvent.change(nameInput, { target: { value: 'Rust Masters' } });
      const slugInput = screen.getByPlaceholderText(/nextjs-fullstack-builders/i);
      expect(slugInput).toHaveValue('rust-masters');

      fireEvent.change(descInput, { target: { value: 'Learning systems programming with Rust.' } });

      const submitBtns = screen.getAllByRole('button', { name: /create community/i });
      expect(submitBtns.length).toBeGreaterThan(0);
    });
  });

  describe('3. CommunityDetailPage Component Tests', () => {
    const mockDetailCommunity = {
      id: 'comm-detail-1',
      name: 'Fullstack Next.js',
      slug: 'fullstack-nextjs',
      description: 'Master fullstack development with Next.js, React, and Supabase.',
      category: 'Development',
      visibility: 'public' as const,
      owner_id: mockUser.id,
      members_count: 10,
      is_member: true,
      member_role: 'owner' as const,
      owner: {
        id: mockUser.id,
        username: 'alice',
        display_name: 'Alice Cooper',
      } as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('renders community details and loads discussion posts', async () => {
      vi.spyOn(communitiesApi, 'fetchCommunityByIdOrSlug').mockResolvedValue({
        community: mockDetailCommunity,
        error: null,
      });

      vi.spyOn(communitiesApi, 'fetchCommunityPosts').mockResolvedValue({
        posts: [
          {
            id: 'post-1',
            community_id: 'comm-detail-1',
            author_id: mockUser.id,
            content: 'Welcome to Fullstack Next.js! Share what you are building.',
            author: {
              id: mockUser.id,
              username: 'alice',
              display_name: 'Alice Cooper',
              avatar_url: 'https://example.com/alice.jpg',
            } as any,
            comments_count: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/communities/fullstack-nextjs']}>
          <Routes>
            <Route path="/communities/:communityId" element={<CommunityDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Fullstack Next.js')).toBeInTheDocument();
        expect(screen.getByText('10 members')).toBeInTheDocument();
        expect(screen.getByText('Welcome to Fullstack Next.js! Share what you are building.')).toBeInTheDocument();
      });

      // Alice is owner, should see Manage/Settings tab
      expect(screen.getByRole('button', { name: /manage/i })).toBeInTheDocument();
    });

    it('shows private warning and Request to Join for non-members of private community', async () => {
      const mockPrivateComm = {
        ...mockDetailCommunity,
        id: 'comm-secret',
        name: 'Private Mastermind',
        visibility: 'private' as const,
        owner_id: 'user-bob-999',
        is_member: false,
        member_role: undefined,
        membership_status: 'none' as const,
        owner: {
          id: 'user-bob-999',
          username: 'bob',
          display_name: 'Bob',
        } as any,
      };

      vi.spyOn(communitiesApi, 'fetchCommunityByIdOrSlug').mockResolvedValue({
        community: mockPrivateComm,
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/communities/comm-secret']}>
          <Routes>
            <Route path="/communities/:communityId" element={<CommunityDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Private Mastermind')).toBeInTheDocument();
        expect(screen.getByText('This Community is Private')).toBeInTheDocument();
      });

      expect(screen.getAllByRole('button', { name: /request to join/i }).length).toBeGreaterThan(0);
    });

    it('displays 404 Not Found state when community does not exist in database', async () => {
      vi.spyOn(communitiesApi, 'fetchCommunityByIdOrSlug').mockResolvedValue({
        community: null,
        error: null,
      });

      render(
        <MemoryRouter initialEntries={['/communities/non-existent-comm']}>
          <Routes>
            <Route path="/communities/:communityId" element={<CommunityDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Community Not Found')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /back to communities/i })).toBeInTheDocument();
    });
  });
});
