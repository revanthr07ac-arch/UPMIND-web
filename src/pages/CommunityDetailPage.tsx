import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Lock,
  Globe,
  ArrowLeft,
  MessageSquare,
  Send,
  Trash2,
  Settings,
  Check,
  Clock,
  AlertCircle,
  RotateCcw,
  Shield,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import {
  fetchCommunityByIdOrSlug,
  joinCommunity,
  leaveCommunity,
  fetchCommunityPosts,
  createCommunityPost,
  deleteCommunityPost,
  fetchCommunityPostComments,
  createCommunityPostComment,
  fetchCommunityMembers,
  fetchCommunityJoinRequests,
  respondToJoinRequest,
  updateCommunity,
  deleteCommunity,
} from '../lib/communities';
import { formatTimeAgo } from '../lib/utils';
import type {
  Community,
  CommunityPost,
  CommunityMember,
  CommunityJoinRequest,
  CommunityPostComment,
} from '../types/database';

export const CommunityDetailPage: React.FC = () => {
  const { communityId } = useParams<{ communityId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<'discussions' | 'members' | 'settings'>('discussions');

  // Discussions state
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [postCommentsMap, setPostCommentsMap] = useState<Record<string, CommunityPostComment[]>>({});
  const [newCommentContentMap, setNewCommentContentMap] = useState<Record<string, string>>({});
  const [isCommentingPostId, setIsCommentingPostId] = useState<string | null>(null);

  // Members & Requests state
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [requests, setRequests] = useState<CommunityJoinRequest[]>([]);

  // Settings Edit State
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('public');
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Action loading states
  const [isJoining, setIsJoining] = useState(false);

  // Load Community Details
  const loadCommunity = useCallback(async () => {
    if (!communityId) return;
    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    const res = await fetchCommunityByIdOrSlug(communityId, user?.id);

    if (res.isNotFound) {
      setIsNotFound(true);
      setCommunity(null);
    } else if (res.error) {
      setError(res.error);
      setCommunity(null);
    } else if (res.community) {
      setCommunity(res.community);
      setEditName(res.community.name);
      setEditDescription(res.community.description || '');
      setEditCategory(res.community.category);
      setEditVisibility(res.community.visibility || (res.community.is_private ? 'private' : 'public'));
    }
    setIsLoading(false);
  }, [communityId, user?.id]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  // Load discussions
  const loadPosts = useCallback(async () => {
    if (!community) return;
    const res = await fetchCommunityPosts(community.id);
    if (!res.error) {
      setPosts(res.posts);
    }
  }, [community]);

  // Load members
  const loadMembers = useCallback(async () => {
    if (!community) return;
    const res = await fetchCommunityMembers(community.id);
    if (!res.error) {
      setMembers(res.members);
    }
  }, [community]);

  // Load join requests (for owner / moderator)
  const loadRequests = useCallback(async () => {
    if (!community) return;
    const isOwnerOrMod =
      community.role === 'owner' ||
      community.role === 'moderator' ||
      community.role === 'admin';
    if (!isOwnerOrMod) return;

    const res = await fetchCommunityJoinRequests(community.id);
    if (!res.error) {
      setRequests(res.requests);
    }
  }, [community]);

  useEffect(() => {
    if (!community) return;
    if (activeTab === 'discussions') {
      loadPosts();
    } else if (activeTab === 'members') {
      loadMembers();
    } else if (activeTab === 'settings') {
      loadRequests();
    }
  }, [community, activeTab, loadPosts, loadMembers, loadRequests]);

  // Handle Join or Request Join
  const handleJoin = async () => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    if (!community) return;

    setIsJoining(true);
    const isPrivate = community.visibility === 'private' || Boolean(community.is_private);
    const res = await joinCommunity(community.id, user.id, isPrivate);

    if (res.success) {
      await loadCommunity();
    } else {
      alert(res.error || 'Failed to join community.');
    }
    setIsJoining(false);
  };

  // Handle Leave
  const handleLeave = async () => {
    if (!user || !community) return;
    const isOwner = community.role === 'owner';
    const res = await leaveCommunity(community.id, user.id, isOwner);

    if (res.success) {
      await loadCommunity();
    } else {
      alert(res.error || 'Failed to leave community.');
    }
  };

  // Create Discussion Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !community || !newPostContent.trim()) return;

    setIsPosting(true);
    const res = await createCommunityPost(community.id, user.id, newPostContent.trim());

    if (res.post) {
      setPosts((prev) => [res.post!, ...prev]);
      setNewPostContent('');
    } else {
      alert(res.error || 'Failed to submit discussion post.');
    }
    setIsPosting(false);
  };

  // Delete Discussion Post
  const handleDeletePost = async (postId: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this discussion post?')) return;
    const res = await deleteCommunityPost(postId, user.id);
    if (res.success) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } else {
      alert(res.error || 'Could not delete post.');
    }
  };

  // Toggle comments expand and load
  const toggleComments = async (postId: string) => {
    if (expandedCommentsPostId === postId) {
      setExpandedCommentsPostId(null);
      return;
    }

    setExpandedCommentsPostId(postId);
    if (!postCommentsMap[postId]) {
      const res = await fetchCommunityPostComments(postId);
      if (!res.error) {
        setPostCommentsMap((prev) => ({ ...prev, [postId]: res.comments }));
      }
    }
  };

  // Submit comment
  const handleAddComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    const content = (newCommentContentMap[postId] || '').trim();
    if (!content) return;

    setIsCommentingPostId(postId);
    const res = await createCommunityPostComment(postId, user.id, content);

    if (res.comment) {
      setPostCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), res.comment!],
      }));
      setNewCommentContentMap((prev) => ({ ...prev, [postId]: '' }));
      // Increment comment count on post
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
      );
    } else {
      alert(res.error || 'Could not post comment.');
    }
    setIsCommentingPostId(null);
  };

  // Respond to Join Request (Approve / Reject)
  const handleRequestResponse = async (requestId: string, applicantId: string, approve: boolean) => {
    if (!community) return;
    const res = await respondToJoinRequest(requestId, community.id, applicantId, approve);
    if (res.success) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      await loadCommunity();
    } else {
      alert(res.error || 'Could not process request.');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community) return;

    setIsUpdatingSettings(true);
    setSettingsSuccess(null);

    const res = await updateCommunity(community.id, {
      name: editName,
      description: editDescription,
      category: editCategory,
      visibility: editVisibility,
    });

    if (res.success) {
      setSettingsSuccess('Community settings updated successfully.');
      await loadCommunity();
    } else {
      alert(res.error || 'Could not update settings.');
    }
    setIsUpdatingSettings(false);
  };

  // Delete Community
  const handleDeleteCommunity = async () => {
    if (!community) return;
    const confirmation = window.prompt(
      `To confirm permanent deletion, type "${community.name}" below:`
    );
    if (confirmation !== community.name) {
      alert('Community name did not match. Deletion cancelled.');
      return;
    }

    setIsDeleting(true);
    const res = await deleteCommunity(community.id);
    if (res.success) {
      navigate('/communities');
    } else {
      alert(res.error || 'Could not delete community.');
      setIsDeleting(false);
    }
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-24 select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-[#E5484D] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-[#858995] tracking-wider uppercase">
            Loading Community...
          </span>
        </div>
      </div>
    );
  }

  // 2. Not Found State
  if (isNotFound || !community) {
    return (
      <div className="w-full max-w-md mx-auto py-16 text-center flex flex-col items-center bg-[#15161B] border border-[#292B34] rounded-[24px] p-8 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-[#1B1D24] border border-[#292B34] flex items-center justify-center text-[#858995] mb-4">
          <Users className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#F5F5F7] mb-2">Community Not Found</h2>
        <p className="text-xs text-[#858995] mb-6 max-w-sm leading-relaxed">
          The skill community you are looking for does not exist or may have been removed.
        </p>
        <Button
          variant="primary"
          size="md"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/communities')}
        >
          Back to Communities
        </Button>
      </div>
    );
  }

  // 3. Error State
  if (error) {
    return (
      <div className="w-full max-w-md mx-auto py-16 text-center flex flex-col items-center bg-[#15161B] border border-[#292B34] rounded-[24px] p-8 shadow-xl">
        <div className="w-14 h-14 rounded-full bg-[#32191D] border border-[#E5484D]/30 flex items-center justify-center text-[#FF6269] mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#F5F5F7] mb-2">Unable to load community</h2>
        <p className="text-xs text-[#858995] mb-6 max-w-sm leading-relaxed">{error}</p>
        <button
          onClick={() => loadCommunity()}
          className="inline-flex items-center gap-2 bg-[#E5484D] hover:bg-[#D7373F] text-white text-xs font-semibold px-5 py-2.5 rounded-[12px] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  const isPrivate = community.visibility === 'private' || Boolean(community.is_private);
  const isOwner = !!user && (community.owner_id === user.id || community.created_by === user.id || community.role === 'owner');
  const isMember = community.is_member || isOwner;
  const isPendingRequest = community.membership_status === 'pending';
  const isOwnerOrModerator =
    isOwner ||
    community.role === 'moderator' ||
    community.role === 'admin';

  return (
    <div className="w-full flex flex-col gap-6 select-none pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate('/communities')}
        className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-[#858995] hover:text-[#F5F5F7] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>All Communities</span>
      </button>

      {/* Community Header Card */}
      <div className="w-full bg-[#15161B] border border-[#292B34] rounded-[24px] overflow-hidden shadow-2xl flex flex-col">
        {/* Cover Banner */}
        <div className="w-full h-36 sm:h-48 relative overflow-hidden bg-gradient-to-r from-[#1B1D24] via-[#23252D] to-[#15161B]">
          {community.cover_url ? (
            <img
              src={community.cover_url}
              alt={community.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center opacity-20">
              <Users className="w-24 h-24 text-white" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#15161B] via-transparent to-transparent" />
        </div>

        {/* Community Info Body */}
        <div className="px-5 sm:px-8 pb-6 -mt-12 relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-[20px] bg-[#1B1D24] border-3 border-[#15161B] shadow-xl flex items-center justify-center text-[#E5484D] font-black text-2xl shrink-0 overflow-hidden">
              {community.avatar_url ? (
                <img
                  src={community.avatar_url}
                  alt={community.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                community.name.substring(0, 2).toUpperCase()
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#F5F5F7] tracking-tight">
                  {community.name}
                </h1>
                {isPrivate ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#858995] bg-[#1B1D24] px-2 py-0.5 rounded-[6px] border border-[#292B34]">
                    <Lock className="w-3 h-3 text-[#E5484D]" /> Private
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#858995] bg-[#1B1D24] px-2 py-0.5 rounded-[6px] border border-[#292B34]">
                    <Globe className="w-3 h-3 text-[#35B883]" /> Public
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-[#858995]">
                <span className="text-[#E5484D] font-semibold">{community.category}</span>
                <span>•</span>
                <span>
                  {community.members_count} {community.members_count === 1 ? 'member' : 'members'}
                </span>
                {community.owner && (
                  <>
                    <span>•</span>
                    <span
                      onClick={() => navigate(`/u/${community.owner?.username}`)}
                      className="hover:underline cursor-pointer text-[#B0B3BD]"
                    >
                      Created by @{community.owner.username}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isOwner ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[12px] bg-[#E5484D]/10 text-[#E5484D] font-semibold text-xs border border-[#E5484D]/30">
                <Shield className="w-3.5 h-3.5" /> Community Owner
              </span>
            ) : isMember ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-2 rounded-[10px] bg-[#1B1D24] text-[#35B883] font-semibold text-xs border border-[#292B34]">
                  <Check className="w-3.5 h-3.5" /> Joined
                </span>
                <button
                  onClick={handleLeave}
                  className="px-3 py-2 rounded-[10px] text-xs font-semibold text-[#858995] hover:text-[#FF6269] hover:bg-[#32191D] border border-transparent hover:border-[#E5484D]/30 transition-colors cursor-pointer"
                >
                  Leave
                </button>
              </div>
            ) : isPendingRequest ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[12px] bg-[#1B1D24] text-[#FF7479] font-semibold text-xs border border-[#292B34]">
                <Clock className="w-3.5 h-3.5" /> Request Pending
              </span>
            ) : (
              <Button
                variant="primary"
                size="md"
                isLoading={isJoining}
                onClick={handleJoin}
              >
                {isPrivate ? 'Request to Join' : 'Join Community'}
              </Button>
            )}
          </div>
        </div>

        {/* Description row */}
        {community.description && (
          <div className="px-5 sm:px-8 pb-6 border-t border-[#292B34]/60 pt-4">
            <p className="text-xs sm:text-sm text-[#B0B3BD] leading-relaxed max-w-3xl">
              {community.description}
            </p>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 sm:px-8 border-t border-[#292B34] bg-[#101116]/50">
          <button
            onClick={() => setActiveTab('discussions')}
            className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'discussions'
                ? 'border-[#E5484D] text-[#F5F5F7]'
                : 'border-transparent text-[#858995] hover:text-[#F5F5F7]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Discussions</span>
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'members'
                ? 'border-[#E5484D] text-[#F5F5F7]'
                : 'border-transparent text-[#858995] hover:text-[#F5F5F7]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Members ({community.members_count})</span>
          </button>

          {isOwnerOrModerator && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'border-[#E5484D] text-[#F5F5F7]'
                  : 'border-transparent text-[#858995] hover:text-[#F5F5F7]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>
                Manage {requests.length > 0 ? `(${requests.length} requests)` : ''}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Private community access restriction card */}
      {isPrivate && !isMember && (
        <div className="w-full bg-[#15161B] border border-[#292B34] rounded-[20px] p-8 sm:p-12 text-center flex flex-col items-center shadow-xl">
          <div className="w-14 h-14 rounded-full bg-[#32191D] border border-[#E5484D]/30 flex items-center justify-center text-[#FF6269] mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-[#F5F5F7] mb-2">This Community is Private</h2>
          <p className="text-xs text-[#858995] mb-6 max-w-md leading-relaxed">
            Discussions and member lists are restricted to approved members. Submit a request to the community owner to join.
          </p>
          {isPendingRequest ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[12px] bg-[#1B1D24] text-[#FF7479] font-semibold text-xs border border-[#292B34]">
              <Clock className="w-4 h-4" /> Join Request Pending Review
            </span>
          ) : (
            <Button
              variant="primary"
              size="md"
              isLoading={isJoining}
              onClick={handleJoin}
            >
              Request to Join
            </Button>
          )}
        </div>
      )}

      {/* TAB 1: Discussions Feed */}
      {activeTab === 'discussions' && (!isPrivate || isMember) && (
        <div className="flex flex-col gap-5">
          {/* Create Post Card for Members */}
          {isMember ? (
            <form
              onSubmit={handleCreatePost}
              className="bg-[#15161B] border border-[#292B34] rounded-[18px] p-4 flex flex-col gap-3 shadow-card"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.full_name || profile?.username || user?.email || 'User'}
                  size="sm"
                />
                <textarea
                  rows={2}
                  required
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Share a skill, start a discussion, or ask a question in this community..."
                  className="w-full bg-[#101116] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[12px] border border-[#292B34] p-3 focus:border-[#FF7479] focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#858995]">
                  Posts are visible to all community peers
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isPosting}
                  leftIcon={<Send className="w-3 h-3" />}
                >
                  Post Discussion
                </Button>
              </div>
            </form>
          ) : (
            <div className="bg-[#15161B]/50 border border-dashed border-[#292B34] rounded-[16px] p-4 text-center text-xs text-[#858995] flex items-center justify-center gap-2">
              <span>Join this community to start discussions and reply to members.</span>
              <button
                onClick={handleJoin}
                className="text-[#E5484D] font-semibold hover:underline cursor-pointer"
              >
                Join Now
              </button>
            </div>
          )}

          {/* Posts List */}
          {posts.length === 0 ? (
            <div className="bg-[#15161B] border border-[#292B34] rounded-[18px] p-10 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[#1B1D24] border border-[#292B34] flex items-center justify-center text-[#858995] mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#F5F5F7] mb-1">No discussions yet</h3>
              <p className="text-xs text-[#858995] max-w-sm">
                Be the first to share an insight, tutorial link, or ask for peer guidance!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {posts.map((post) => {
                const isAuthor = user?.id === post.author_id;
                const canDelete = isAuthor || isOwnerOrModerator;
                const isCommentsOpen = expandedCommentsPostId === post.id;
                const comments = postCommentsMap[post.id] || [];

                return (
                  <div
                    key={post.id}
                    className="bg-[#15161B] border border-[#292B34] rounded-[18px] p-5 flex flex-col gap-3 shadow-card"
                  >
                    {/* Author header */}
                    <div className="flex items-center justify-between">
                      <div
                        onClick={() => {
                          if (post.author?.username) {
                            navigate(`/u/${post.author.username}`);
                          }
                        }}
                        className="flex items-center gap-2.5 cursor-pointer"
                      >
                        <Avatar
                          src={post.author?.avatar_url}
                          name={post.author?.full_name || post.author?.username}
                          size="sm"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[#F5F5F7] hover:underline">
                            {post.author?.display_name || post.author?.full_name || post.author?.username || 'Community Member'}
                          </span>
                          <span className="text-[10px] text-[#858995]">
                            {formatTimeAgo(post.created_at)}
                          </span>
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          title="Delete discussion post"
                          className="p-1.5 rounded-[8px] text-[#858995] hover:text-[#FF6269] hover:bg-[#32191D]/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Content */}
                    <p className="text-xs sm:text-sm text-[#F5F5F7] leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>

                    {/* Actions bar */}
                    <div className="pt-2 border-t border-[#292B34]/60 flex items-center justify-between">
                      <button
                        onClick={() => toggleComments(post.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#858995] hover:text-[#F5F5F7] transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>
                          {post.comments_count || 0}{' '}
                          {post.comments_count === 1 ? 'comment' : 'comments'}
                        </span>
                      </button>
                    </div>

                    {/* Threaded Comments Section */}
                    {isCommentsOpen && (
                      <div className="pt-3 border-t border-[#292B34] flex flex-col gap-3">
                        {/* Comments list */}
                        {comments.length > 0 && (
                          <div className="flex flex-col gap-2.5 pl-3 border-l-2 border-[#292B34]">
                            {comments.map((comm) => (
                              <div key={comm.id} className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <Avatar
                                    src={comm.author?.avatar_url}
                                    name={comm.author?.username}
                                    size="xs"
                                  />
                                  <span
                                    onClick={() => {
                                      if (comm.author?.username) {
                                        navigate(`/u/${comm.author.username}`);
                                      }
                                    }}
                                    className="text-xs font-bold text-[#F5F5F7] hover:underline cursor-pointer"
                                  >
                                    @{comm.author?.username || 'member'}
                                  </span>
                                  <span className="text-[10px] text-[#858995]">
                                    {formatTimeAgo(comm.created_at)}
                                  </span>
                                </div>
                                <p className="text-xs text-[#B0B3BD] pl-6 leading-relaxed">
                                  {comm.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Comment Input */}
                        {isMember ? (
                          <form
                            onSubmit={(e) => handleAddComment(e, post.id)}
                            className="flex items-center gap-2 mt-1"
                          >
                            <input
                              type="text"
                              required
                              value={newCommentContentMap[post.id] || ''}
                              onChange={(e) =>
                                setNewCommentContentMap((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value,
                                }))
                              }
                              placeholder="Write a reply..."
                              className="flex-1 bg-[#101116] text-[#F5F5F7] text-xs rounded-[10px] border border-[#292B34] px-3 py-2 focus:border-[#FF7479] focus:outline-none"
                            />
                            <Button
                              type="submit"
                              variant="primary"
                              size="sm"
                              isLoading={isCommentingPostId === post.id}
                            >
                              Reply
                            </Button>
                          </form>
                        ) : (
                          <span className="text-[11px] text-[#858995]">
                            Join community to reply.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Members List */}
      {activeTab === 'members' && (!isPrivate || isMember) && (
        <div className="bg-[#15161B] border border-[#292B34] rounded-[20px] p-5 sm:p-6 shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-[#292B34] mb-4">
            <h2 className="text-sm font-bold text-[#F5F5F7]">
              Community Members ({members.length})
            </h2>
            <span className="text-xs text-[#858995]">Active peer learners</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map((mem) => (
              <div
                key={mem.id}
                onClick={() => {
                  if (mem.profile?.username) {
                    navigate(`/u/${mem.profile.username}`);
                  }
                }}
                className="flex items-center justify-between p-3 rounded-[14px] bg-[#101116] border border-[#292B34] hover:border-[#393C47] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={mem.profile?.avatar_url}
                    name={mem.profile?.full_name || mem.profile?.username}
                    size="md"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#F5F5F7]">
                      {mem.profile?.display_name || mem.profile?.full_name || mem.profile?.username || 'Peer'}
                    </span>
                    <span className="text-[11px] text-[#858995]">
                      @{mem.profile?.username || 'user'}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-[6px] capitalize ${
                    mem.role === 'owner'
                      ? 'bg-[#E5484D]/20 text-[#E5484D] border border-[#E5484D]/30'
                      : mem.role === 'moderator' || mem.role === 'admin'
                      ? 'bg-[#35B883]/20 text-[#35B883] border border-[#35B883]/30'
                      : 'bg-[#1B1D24] text-[#858995]'
                  }`}
                >
                  {mem.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Settings & Requests (Owner / Moderator only) */}
      {activeTab === 'settings' && isOwnerOrModerator && (
        <div className="flex flex-col gap-6">
          {/* Pending Join Requests (for private communities) */}
          {isPrivate && (
            <div className="bg-[#15161B] border border-[#292B34] rounded-[20px] p-5 sm:p-6 shadow-card">
              <div className="pb-3 border-b border-[#292B34] mb-4">
                <h2 className="text-sm font-bold text-[#F5F5F7]">
                  Pending Join Requests ({requests.length})
                </h2>
                <p className="text-xs text-[#858995]">
                  Approve or reject prospective members requesting to enter this private community.
                </p>
              </div>

              {requests.length === 0 ? (
                <p className="text-xs text-[#858995] py-4 text-center">
                  No pending membership requests right now.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 rounded-[12px] bg-[#101116] border border-[#292B34]"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={req.profile?.avatar_url}
                          name={req.profile?.username}
                          size="sm"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-[#F5F5F7]">
                            {req.profile?.full_name || req.profile?.username}
                          </span>
                          <span className="text-[10px] text-[#858995]">
                            Requested {formatTimeAgo(req.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRequestResponse(req.id, req.user_id, true)}
                          className="px-3 py-1.5 rounded-[8px] text-xs font-semibold bg-[#35B883] text-white hover:bg-[#2fa373] transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleRequestResponse(req.id, req.user_id, false)}
                          className="px-3 py-1.5 rounded-[8px] text-xs font-semibold bg-[#1B1D24] text-[#FF6269] hover:bg-[#32191D] border border-[#292B34] transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edit Details Form */}
          <div className="bg-[#15161B] border border-[#292B34] rounded-[20px] p-5 sm:p-6 shadow-card">
            <h2 className="text-sm font-bold text-[#F5F5F7] mb-1">Community Details</h2>
            <p className="text-xs text-[#858995] mb-4">
              Update community name, description, and visibility.
            </p>

            {settingsSuccess && (
              <div className="p-3 mb-4 rounded-[10px] bg-[#35B883]/15 border border-[#35B883]/40 text-xs text-[#35B883] flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{settingsSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#B0B3BD]">Community Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#101116] text-[#F5F5F7] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#B0B3BD]">Description</label>
                <textarea
                  rows={3}
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-[#101116] text-[#F5F5F7] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isUpdatingSettings}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>

          {/* Danger Zone: Delete Community (Owner only) */}
          {isOwner && (
            <div className="bg-[#15161B] border border-[#E5484D]/40 rounded-[20px] p-5 sm:p-6 shadow-card">
              <h2 className="text-sm font-bold text-[#FF6269] mb-1">Danger Zone</h2>
              <p className="text-xs text-[#858995] mb-4 leading-relaxed">
                Permanently delete this community, discussions, and member associations. This action cannot be undone.
              </p>
              <Button
                variant="outline"
                size="sm"
                isLoading={isDeleting}
                onClick={handleDeleteCommunity}
                className="text-[#FF6269] border-[#FF6269]/40 hover:bg-[#FF6269]/10"
              >
                Delete Community
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
