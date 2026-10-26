export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  display_name?: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  education?: string | null;
  institution?: string | null;
  course?: string | null;
  website_url?: string | null;
  interests: string[];
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  portfolio_links: Array<{ title: string; url: string }> | Json;
  followers_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string | null;
  created_at: string;
}

export interface UserSkill {
  id: string;
  user_id: string;
  skill_id: string;
  intent: 'teaching' | 'learning';
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  proficiency_level?: 'beginner' | 'intermediate' | 'advanced';
  description: string | null;
  created_at: string;
  skill?: Skill;
}

export interface Post {
  id: string;
  author_id: string;
  caption: string;
  image_url: string | null;
  video_url?: string | null;
  media_urls?: string[];
  post_type: 'text' | 'image' | 'tutorial' | 'reel' | 'video';
  educational_description: string | null;
  skill_tags: string[];
  visibility: 'public' | 'private';
  likes_count: number;
  comments_count: number;
  is_reel?: boolean;
  created_at: string;
  updated_at: string;
  author?: Profile;
  is_liked?: boolean;
  is_saved?: boolean;
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface SavedPost {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
  post?: Post;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  created_at: string;
  expires_at: string;
  author?: Profile;
}

export interface LearningRequest {
  id: string;
  learner_id: string;
  teacher_id: string;
  skill_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';
  resource_url?: string | null;
  resource_note?: string | null;
  resource_name?: string | null;
  post_id?: string | null;
  fulfilled_at?: string | null;
  created_at: string;
  updated_at: string;
  learner?: Profile;
  teacher?: Profile;
  skill?: Skill;
  post?: Post;
}

export interface Conversation {
  id: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  members?: ConversationMember[];
  last_message?: Message;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'resource';
  created_at: string;
  sender?: Profile;
  resource?: SharedResource;
}

export interface SharedResource {
  id: string;
  conversation_id: string;
  message_id?: string | null;
  uploader_id: string;
  title: string;
  resource_type: 'link' | 'note' | 'file';
  url: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  created_at: string;
  uploader?: Profile;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type:
    | 'follow'
    | 'comment'
    | 'like'
    | 'learning_request_new'
    | 'learning_request_accepted'
    | 'learning_request_declined'
    | 'learning_request_completed'
    | 'new_message';
  related_entity_id: string | null;
  is_read: boolean;
  created_at: string;
  actor?: Profile;
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  cover_image_path?: string | null;
  category: string;
  is_private?: boolean;
  visibility?: 'public' | 'private';
  created_by?: string;
  owner_id?: string;
  owner?: Profile;
  members_count: number;
  created_at: string;
  updated_at: string;
  is_member?: boolean;
  role?: 'owner' | 'moderator' | 'member' | 'admin';
  membership_status?: 'none' | 'member' | 'pending' | 'rejected';
}

export interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: 'owner' | 'moderator' | 'member' | 'admin';
  joined_at: string;
  profile?: Profile;
}

export interface CommunityJoinRequest {
  id: string;
  community_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface CommunityPost {
  id: string;
  community_id: string;
  author_id: string;
  title?: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  author?: Profile;
  comments_count?: number;
  media?: CommunityPostMedia[];
}

export interface CommunityPostComment {
  id: string;
  community_post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface CommunityPostMedia {
  id: string;
  community_post_id: string;
  storage_path: string;
  media_type: string;
  created_at: string;
}

export interface Block {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_post_id: string | null;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  created_at: string;
}
