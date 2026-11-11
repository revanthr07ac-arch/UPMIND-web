import { supabase } from './supabase';
import type { Profile } from '../types/database';

/**
 * Retrieves an existing 1-on-1 conversation between two users or creates
 * a new one safely using stepwise member insertion.
 */
export async function getOrCreateDirectConversation(
  currentUserId: string,
  targetUserId: string
): Promise<{ conversationId: string | null; error?: string }> {
  if (!currentUserId || !targetUserId) {
    return { conversationId: null, error: 'Both user IDs are required.' };
  }

  if (currentUserId === targetUserId) {
    return { conversationId: null, error: 'Cannot create a conversation with yourself.' };
  }

  try {
    // 1. Check if conversation already exists between current user and target user
    const { data: myMemberships, error: memberErr } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', currentUserId);

    if (!memberErr && myMemberships && myMemberships.length > 0) {
      const convIds = myMemberships.map((m) => m.conversation_id);

      const { data: matchedMember, error: matchErr } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', targetUserId)
        .in('conversation_id', convIds)
        .limit(1)
        .maybeSingle();

      if (!matchErr && matchedMember?.conversation_id) {
        return { conversationId: matchedMember.conversation_id };
      }
    }

    // 2. Create new conversation record
    const convId = crypto.randomUUID();
    const { error: convErr } = await supabase
      .from('conversations')
      .insert({ id: convId, created_by: currentUserId });

    if (convErr) {
      console.error('Failed to insert conversation:', convErr);
      return { conversationId: null, error: convErr.message || 'Failed to initialize conversation.' };
    }

    // 3. Stepwise insert: Creator becomes member first
    const { error: mem1Err } = await supabase
      .from('conversation_members')
      .insert({ conversation_id: convId, user_id: currentUserId });

    if (mem1Err) {
      console.error('Failed to add creator as member:', mem1Err);
      return { conversationId: null, error: mem1Err.message || 'Failed to add participant.' };
    }

    // 4. Stepwise insert: Target user added as member
    const { error: mem2Err } = await supabase
      .from('conversation_members')
      .insert({ conversation_id: convId, user_id: targetUserId });

    if (mem2Err) {
      console.error('Failed to add target user as member:', mem2Err);
      return { conversationId: null, error: mem2Err.message || 'Failed to complete conversation setup.' };
    }

    return { conversationId: convId };
  } catch (err: any) {
    console.error('getOrCreateDirectConversation exception:', err);
    return { conversationId: null, error: err.message || 'Unexpected error creating conversation.' };
  }
}

/**
 * Verifies whether a user is an authorized participant in a specific conversation.
 * Returns true only if an authenticated membership row exists for this user and conversation.
 */
export async function verifyConversationMembership(
  conversationId: string,
  userId: string
): Promise<boolean> {
  if (!conversationId || !userId) return false;
  try {
    const { data, error } = await supabase
      .from('conversation_members')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch (err) {
    console.error('verifyConversationMembership error:', err);
    return false;
  }
}

/**
 * Fetches the other participant profile in a conversation given the current user.
 * Strictly verifies participant membership before returning partner data.
 */
export async function fetchDirectPartner(
  conversationId: string,
  currentUserId: string
): Promise<Profile | null> {
  if (!conversationId || !currentUserId) return null;

  try {
    // 1. Enforce privacy: current user must be an enrolled participant
    const isMember = await verifyConversationMembership(conversationId, currentUserId);
    if (!isMember) {
      return null;
    }

    const { data: members, error } = await supabase
      .from('conversation_members')
      .select('user_id, profile:user_id(*)')
      .eq('conversation_id', conversationId);

    if (error || !members) return null;

    const partnerRow = members.find((m: any) => m.user_id !== currentUserId);
    if (!partnerRow?.profile) return null;

    return partnerRow.profile as unknown as Profile;
  } catch (err) {
    console.error('fetchDirectPartner exception:', err);
    return null;
  }
}

