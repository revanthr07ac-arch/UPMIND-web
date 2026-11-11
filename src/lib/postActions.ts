import { supabase } from './supabase';

/**
 * Extracts storage bucket and user-scoped file path from a public Supabase URL.
 * Strictly verifies that the file is located within the given user's directory
 * to prevent unauthorized deletion of other users' assets.
 */
export function extractUserStoragePath(
  url: string | null | undefined,
  userId: string
): { bucket: string; path: string } | null {
  if (!url || typeof url !== 'string') return null;

  // Expected Supabase storage URL format:
  // .../storage/v1/object/public/<bucket>/<path>
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;

  const bucket = match[1];
  // Strip query parameters (e.g. ?t=...)
  const rawPath = match[2].split('?')[0];
  const path = decodeURIComponent(rawPath);

  // Security guard: Ensure path starts with the authenticated user's ID
  if (!path.startsWith(`${userId}/`)) {
    return null;
  }

  return { bucket, path };
}

/**
 * Safely deletes a post and its associated storage assets.
 * Enforces ownership check against the authenticated user ID at both
 * query level and database RLS level.
 */
export async function deleteUserPost(
  postId: string,
  userId: string,
  imageUrl?: string | null,
  videoUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!postId || !userId) {
    return { success: false, error: 'Invalid post or user identifier.' };
  }

  try {
    // 1. Delete post record from database first.
    // The RLS policy requires auth.uid() = author_id.
    const { error: dbError } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('author_id', userId);

    if (dbError) {
      console.error('Failed to delete post record:', dbError);
      return { success: false, error: dbError.message || 'Failed to delete post from database.' };
    }

    // 2. Safe cleanup of storage media owned by this user
    const mediaUrls = [imageUrl, videoUrl].filter(Boolean) as string[];
    for (const url of mediaUrls) {
      const storageInfo = extractUserStoragePath(url, userId);
      if (storageInfo) {
        try {
          await supabase.storage.from(storageInfo.bucket).remove([storageInfo.path]);
        } catch (storageErr) {
          console.warn('Storage cleanup non-fatal warning:', storageErr);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('deleteUserPost exception:', err);
    return {
      success: false,
      error: err.message || 'An unexpected error occurred while deleting the post.',
    };
  }
}

