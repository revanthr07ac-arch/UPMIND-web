import { supabase } from './supabase';
import type {
  Community,
  CommunityMember,
  CommunityJoinRequest,
  CommunityPost,
  CommunityPostComment,
} from '../types/database';

export type CommunityErrorType = 'schema_missing' | 'permission_denied' | 'network' | 'unknown';

export function classifyCommunityError(error: any): { type: CommunityErrorType; message: string } {
  if (!error) return { type: 'unknown', message: 'Unknown error occurred.' };

  const code = String(error.code || '');
  const message = String(error.message || '');

  // 1. Missing table / unmigrated schema in PostgREST or Postgres
  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('not find the table') ||
    message.includes('schema cache')
  ) {
    return {
      type: 'schema_missing',
      message:
        'The communities database tables have not been created yet. Please execute the communities SQL migration in the Supabase SQL Editor.',
    };
  }

  // 2. Permission / RLS errors
  if (
    code === '42501' ||
    code === 'PGRST301' ||
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    message.includes('JWT')
  ) {
    return {
      type: 'permission_denied',
      message: 'Access denied by database security policy. Please verify your authentication status.',
    };
  }

  // 3. Network or connection errors
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('connection timed out') ||
    message.includes('fetch failed')
  ) {
    return {
      type: 'network',
      message: 'Network error communicating with the database. Please check your internet connection and try again.',
    };
  }

  // 4. Default database error
  return {
    type: 'unknown',
    message: message || 'Failed to query communities from the server.',
  };
}

export interface FetchCommunitiesParams {
  search?: string;
  category?: string;
  tab?: 'all' | 'my' | 'discover';
  sort?: 'members' | 'recent' | 'name';
  userId?: string;
}

export interface FetchCommunitiesResult {
  communities: Community[];
  error: string | null;
  errorType?: CommunityErrorType;
  isSchemaMissing?: boolean;
}

/**
 * Fetch list of communities with real backend data, filters, sorting, and user membership status
 */
export async function fetchCommunities(
  params: FetchCommunitiesParams = {}
): Promise<FetchCommunitiesResult> {
  const { search, category, tab = 'all', sort = 'members', userId } = params;

  try {
    let query = supabase
      .from('communities')
      .select('*');

    // Category filter
    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    // Search query across name, slug, description, category
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},slug.ilike.${term},description.ilike.${term},category.ilike.${term}`);
    }

    // Sort order
    if (sort === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'name') {
      query = query.order('name', { ascending: true });
    } else {
      query = query.order('members_count', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      const classified = classifyCommunityError(error);
      return {
        communities: [],
        error: classified.message,
        errorType: classified.type,
        isSchemaMissing: classified.type === 'schema_missing',
      };
    }

    let communitiesList: Community[] = (data as any[]) || [];

    // Attach owner profiles if communities exist
    if (communitiesList.length > 0) {
      const ownerIds = Array.from(
        new Set(communitiesList.map((c) => c.owner_id || c.created_by).filter(Boolean))
      );
      if (ownerIds.length > 0) {
        try {
          const { data: owners } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', ownerIds);
          if (owners) {
            const ownerMap = new Map(owners.map((o) => [o.id, o]));
            communitiesList = communitiesList.map((comm) => ({
              ...comm,
              owner: ownerMap.get(comm.owner_id || comm.created_by || '') as any,
            }));
          }
        } catch (_) {
          // Graceful fallback if profiles query fails
        }
      }
    }

    // If user is authenticated, query user's memberships and pending requests
    if (userId && communitiesList.length > 0) {
      const commIds = communitiesList.map((c) => c.id);

      const [membershipsRes, requestsRes] = await Promise.all([
        supabase
          .from('community_members')
          .select('community_id, role')
          .eq('user_id', userId)
          .in('community_id', commIds),
        supabase
          .from('community_join_requests')
          .select('community_id, status')
          .eq('user_id', userId)
          .in('community_id', commIds),
      ]);

      const memberMap: Record<string, { role: string }> = {};
      if (membershipsRes.data) {
        membershipsRes.data.forEach((m: any) => {
          memberMap[m.community_id] = { role: m.role };
        });
      }

      const requestMap: Record<string, string> = {};
      if (requestsRes.data) {
        requestsRes.data.forEach((r: any) => {
          requestMap[r.community_id] = r.status;
        });
      }

      communitiesList = communitiesList.map((comm) => {
        const mem = memberMap[comm.id];
        const isMem = !!mem || comm.owner_id === userId || comm.created_by === userId;
        const role = mem?.role || (comm.owner_id === userId ? 'owner' : undefined);
        const reqStatus = requestMap[comm.id];

        let membership_status: Community['membership_status'] = 'none';
        if (isMem) {
          membership_status = 'member';
        } else if (reqStatus === 'pending') {
          membership_status = 'pending';
        } else if (reqStatus === 'rejected') {
          membership_status = 'rejected';
        }

        return {
          ...comm,
          is_member: isMem,
          role: role as any,
          membership_status,
        };
      });

      // Filter by Tab (All, My Communities, Discover)
      if (tab === 'my') {
        communitiesList = communitiesList.filter((c) => c.is_member);
      } else if (tab === 'discover') {
        communitiesList = communitiesList.filter((c) => !c.is_member);
      }
    } else if (tab === 'my') {
      // Unauthenticated user in "My Communities" sees empty
      communitiesList = [];
    }

    return { communities: communitiesList, error: null };
  } catch (err: any) {
    return {
      communities: [],
      error: err.message || 'Unexpected network error loading communities.',
    };
  }
}

/**
 * Fetch a single community by UUID or unique slug
 */
export async function fetchCommunityByIdOrSlug(
  idOrSlug: string,
  userId?: string
): Promise<{
  community: Community | null;
  error: string | null;
  isNotFound?: boolean;
}> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrSlug
    );

    let query = supabase
      .from('communities')
      .select('*');

    if (isUuid) {
      query = query.eq('id', idOrSlug);
    } else {
      query = query.eq('slug', idOrSlug.toLowerCase());
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      const classified = classifyCommunityError(error);
      return { community: null, error: classified.message };
    }

    if (!data) {
      return { community: null, error: 'Community not found', isNotFound: true };
    }

    let community: Community = data as any;

    // Fetch owner profile if needed
    const ownerId = community.owner_id || community.created_by;
    if (ownerId && !community.owner) {
      try {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, bio')
          .eq('id', ownerId)
          .maybeSingle();
        if (ownerProfile) {
          community.owner = ownerProfile as any;
        }
      } catch (_) {
        // Fallback silently if profile fetch fails
      }
    }

    // Check membership and role if user is authenticated
    if (userId) {
      const [memberRes, reqRes] = await Promise.all([
        supabase
          .from('community_members')
          .select('role')
          .eq('community_id', community.id)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('community_join_requests')
          .select('status')
          .eq('community_id', community.id)
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const isOwner = community.owner_id === userId || community.created_by === userId;
      const isMember = isOwner || !!memberRes.data;
      const role = isOwner ? 'owner' : memberRes.data?.role || (isMember ? 'member' : undefined);

      let membership_status: Community['membership_status'] = 'none';
      if (isMember) {
        membership_status = 'member';
      } else if (reqRes.data?.status === 'pending') {
        membership_status = 'pending';
      } else if (reqRes.data?.status === 'rejected') {
        membership_status = 'rejected';
      }

      community = {
        ...community,
        is_member: isMember,
        role: role as any,
        membership_status,
      };
    }

    return { community, error: null };
  } catch (err: any) {
    return { community: null, error: err.message || 'Error loading community' };
  }
}

/**
 * Create a new community and auto-join the creator as owner
 */
export async function createCommunity(
  payload: {
    name: string;
    slug: string;
    description: string;
    category: string;
    visibility: 'public' | 'private';
    coverUrl?: string;
  },
  userId: string
): Promise<{ community: Community | null; error: string | null }> {
  try {
    const cleanName = payload.name.trim();
    const cleanSlug = payload.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const cleanDesc = payload.description.trim();

    if (cleanName.length < 3 || cleanName.length > 80) {
      return { community: null, error: 'Community name must be between 3 and 80 characters.' };
    }
    if (!cleanSlug || cleanSlug.length < 2) {
      return { community: null, error: 'Please provide a valid slug (letters, numbers, hyphens).' };
    }
    if (cleanDesc.length < 5 || cleanDesc.length > 500) {
      return { community: null, error: 'Description must be between 5 and 500 characters.' };
    }

    // Check slug uniqueness
    const { data: existingSlug } = await supabase
      .from('communities')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (existingSlug) {
      return { community: null, error: 'This community slug or URL is already taken. Please choose another.' };
    }

    const isPrivate = payload.visibility === 'private';

    const insertPayload = {
      name: cleanName,
      slug: cleanSlug,
      description: cleanDesc,
      category: payload.category || 'General',
      is_private: isPrivate,
      visibility: payload.visibility,
      owner_id: userId,
      created_by: userId,
      cover_url: payload.coverUrl || null,
      cover_image_path: payload.coverUrl || null,
      members_count: 1,
    };

    const { data, error } = await supabase
      .from('communities')
      .insert(insertPayload)
      .select('*, owner:owner_id(id, username, full_name, avatar_url)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { community: null, error: 'A community with this name or slug already exists.' };
      }
      return { community: null, error: error.message || 'Failed to create community.' };
    }

    // Add owner to community_members with role 'owner'
    await supabase.from('community_members').insert({
      community_id: data.id,
      user_id: userId,
      role: 'owner',
    });

    const createdComm: Community = {
      ...(data as any),
      is_member: true,
      role: 'owner',
      membership_status: 'member',
    };

    return { community: createdComm, error: null };
  } catch (err: any) {
    return { community: null, error: err.message || 'Unexpected error creating community.' };
  }
}

/**
 * Join a community or submit request for private community
 */
export async function joinCommunity(
  communityId: string,
  userId: string,
  isPrivate: boolean
): Promise<{ success: boolean; status: 'member' | 'pending'; error: string | null }> {
  try {
    if (isPrivate) {
      // Private community: create join request
      const { error } = await supabase
        .from('community_join_requests')
        .insert({
          community_id: communityId,
          user_id: userId,
          status: 'pending',
        });

      if (error) {
        if (error.code === '23505') {
          return { success: true, status: 'pending', error: null };
        }
        return { success: false, status: 'pending', error: error.message };
      }

      return { success: true, status: 'pending', error: null };
    } else {
      // Public community: join directly
      const { error } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: userId,
          role: 'member',
        });

      if (error && error.code !== '23505') {
        return { success: false, status: 'member', error: error.message };
      }

      // Update members_count
      const { count } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId);

      if (count !== null) {
        await supabase
          .from('communities')
          .update({ members_count: count })
          .eq('id', communityId);
      }

      return { success: true, status: 'member', error: null };
    }
  } catch (err: any) {
    return { success: false, status: 'member', error: err.message || 'Failed to join community.' };
  }
}

/**
 * Leave a community
 */
export async function leaveCommunity(
  communityId: string,
  userId: string,
  isOwner: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (isOwner) {
      return {
        success: false,
        error: 'As the community owner, you cannot leave directly. Please transfer ownership or delete the community in Settings.',
      };
    }

    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Refresh count
    const { count } = await supabase
      .from('community_members')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId);

    if (count !== null) {
      await supabase
        .from('communities')
        .update({ members_count: count })
        .eq('id', communityId);
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to leave community.' };
  }
}

/**
 * Fetch discussion posts in a community
 */
export async function fetchCommunityPosts(
  communityId: string
): Promise<{ posts: CommunityPost[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*, author:author_id(id, username, full_name, avatar_url)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });

    if (error) {
      return { posts: [], error: error.message };
    }

    const postsList: CommunityPost[] = (data as any[]) || [];

    // Fetch comment counts
    if (postsList.length > 0) {
      const postIds = postsList.map((p) => p.id);
      const { data: comments } = await supabase
        .from('community_post_comments')
        .select('community_post_id')
        .in('community_post_id', postIds);

      if (comments) {
        const counts: Record<string, number> = {};
        comments.forEach((c: any) => {
          counts[c.community_post_id] = (counts[c.community_post_id] || 0) + 1;
        });
        postsList.forEach((p) => {
          p.comments_count = counts[p.id] || 0;
        });
      }
    }

    return { posts: postsList, error: null };
  } catch (err: any) {
    return { posts: [], error: err.message || 'Failed to fetch discussion posts.' };
  }
}

/**
 * Create a new discussion post
 */
export async function createCommunityPost(
  communityId: string,
  authorId: string,
  content: string,
  title?: string
): Promise<{ post: CommunityPost | null; error: string | null }> {
  try {
    const cleanContent = content.trim();
    if (!cleanContent) {
      return { post: null, error: 'Post content cannot be empty.' };
    }

    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        community_id: communityId,
        author_id: authorId,
        title: title?.trim() || null,
        content: cleanContent,
      })
      .select('*, author:author_id(id, username, full_name, avatar_url)')
      .single();

    if (error) {
      return { post: null, error: error.message };
    }

    return { post: { ...(data as any), comments_count: 0 }, error: null };
  } catch (err: any) {
    return { post: null, error: err.message || 'Failed to create post.' };
  }
}

/**
 * Delete a discussion post
 */
export async function deleteCommunityPost(
  postId: string,
  _userId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch comments on a community post
 */
export async function fetchCommunityPostComments(
  postId: string
): Promise<{ comments: CommunityPostComment[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('community_post_comments')
      .select('*, author:author_id(id, username, full_name, avatar_url)')
      .eq('community_post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      return { comments: [], error: error.message };
    }

    return { comments: (data as any[]) || [], error: null };
  } catch (err: any) {
    return { comments: [], error: err.message };
  }
}

/**
 * Create a comment on a community post
 */
export async function createCommunityPostComment(
  postId: string,
  authorId: string,
  content: string
): Promise<{ comment: CommunityPostComment | null; error: string | null }> {
  try {
    const clean = content.trim();
    if (!clean) {
      return { comment: null, error: 'Comment cannot be empty.' };
    }

    const { data, error } = await supabase
      .from('community_post_comments')
      .insert({
        community_post_id: postId,
        author_id: authorId,
        content: clean,
      })
      .select('*, author:author_id(id, username, full_name, avatar_url)')
      .single();

    if (error) {
      return { comment: null, error: error.message };
    }

    return { comment: data as any, error: null };
  } catch (err: any) {
    return { comment: null, error: err.message };
  }
}

/**
 * Fetch members of a community
 */
export async function fetchCommunityMembers(
  communityId: string
): Promise<{ members: CommunityMember[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('community_members')
      .select('*, profile:user_id(id, username, full_name, avatar_url, bio, experience_level)')
      .eq('community_id', communityId)
      .order('joined_at', { ascending: true });

    if (error) {
      return { members: [], error: error.message };
    }

    return { members: (data as any[]) || [], error: null };
  } catch (err: any) {
    return { members: [], error: err.message };
  }
}

/**
 * Fetch pending join requests for a private community
 */
export async function fetchCommunityJoinRequests(
  communityId: string
): Promise<{ requests: CommunityJoinRequest[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('community_join_requests')
      .select('*, profile:user_id(id, username, full_name, avatar_url)')
      .eq('community_id', communityId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      return { requests: [], error: error.message };
    }

    return { requests: (data as any[]) || [], error: null };
  } catch (err: any) {
    return { requests: [], error: err.message };
  }
}

/**
 * Approve or reject a join request
 */
export async function respondToJoinRequest(
  requestId: string,
  communityId: string,
  applicantUserId: string,
  approve: boolean
): Promise<{ success: boolean; error: string | null }> {
  try {
    const status = approve ? 'approved' : 'rejected';

    const { error: updateErr } = await supabase
      .from('community_join_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    if (approve) {
      await supabase.from('community_members').insert({
        community_id: communityId,
        user_id: applicantUserId,
        role: 'member',
      });

      // Update members_count
      const { count } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId);

      if (count !== null) {
        await supabase
          .from('communities')
          .update({ members_count: count })
          .eq('id', communityId);
      }
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update community details
 */
export async function updateCommunity(
  communityId: string,
  updates: {
    name?: string;
    description?: string;
    category?: string;
    visibility?: 'public' | 'private';
    coverUrl?: string;
  }
): Promise<{ success: boolean; error: string | null }> {
  try {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name) payload.name = updates.name.trim();
    if (updates.description !== undefined) payload.description = updates.description.trim();
    if (updates.category) payload.category = updates.category;
    if (updates.visibility) {
      payload.visibility = updates.visibility;
      payload.is_private = updates.visibility === 'private';
    }
    if (updates.coverUrl !== undefined) {
      payload.cover_url = updates.coverUrl;
      payload.cover_image_path = updates.coverUrl;
    }

    const { error } = await supabase
      .from('communities')
      .update(payload)
      .eq('id', communityId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete community (owner only)
 */
export async function deleteCommunity(
  communityId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('communities')
      .delete()
      .eq('id', communityId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
