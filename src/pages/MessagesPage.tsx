import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Send,
  MessageCircle,
  ArrowLeft,
  CheckCheck,
  Search,
  SquarePen,
  X,
  AlertCircle,
  Sparkles,
  Paperclip,
  FileText,
  Download,
  ShieldAlert,
} from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { Dialog } from '../components/common/Dialog';
import { formatTimeAgo } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  getOrCreateDirectConversation,
  fetchDirectPartner,
  verifyConversationMembership,
} from '../lib/conversations';
import type { Conversation, Message, Profile } from '../types/database';

export const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConvIdFromUrl = searchParams.get('conv');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    activeConvIdFromUrl
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePartner, setActivePartner] = useState<Profile | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [unauthorizedError, setUnauthorizedError] = useState<string | null>(null);

  // Private attachment state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // New message creator search modal
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [creatorSearchQuery, setCreatorSearchQuery] = useState('');
  const [creatorSearchResults, setCreatorSearchResults] = useState<Profile[]>([]);
  const [isSearchingCreators, setIsSearchingCreators] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync activeConversationId with URL parameter if it changes
  useEffect(() => {
    if (activeConvIdFromUrl && activeConvIdFromUrl !== activeConversationId) {
      setActiveConversationId(activeConvIdFromUrl);
    }
  }, [activeConvIdFromUrl, activeConversationId]);

  // 1. Load user's conversations and last messages strictly for authorized participant
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setIsLoadingList(true);

    try {
      // Query memberships strictly for authenticated user id
      const { data: memberRows, error: memberErr } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (memberErr || !memberRows || memberRows.length === 0) {
        setConversations([]);
        setIsLoadingList(false);
        return;
      }

      const convIds = memberRows.map((m) => m.conversation_id);

      // Fetch conversations and their members
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select('*, members:conversation_members(*, profile:user_id(*))')
        .in('id', convIds)
        .order('updated_at', { ascending: false });

      if (!convErr && convData) {
        // Fetch latest message for each authorized conversation
        const enhancedConvs = await Promise.all(
          convData.map(async (conv) => {
            const { data: latestMsg } = await supabase
              .from('messages')
              .select('*')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              ...conv,
              last_message: latestMsg || undefined,
            } as Conversation;
          })
        );

        setConversations(enhancedConvs);

        if (!activeConversationId && enhancedConvs.length > 0) {
          setActiveConversationId(enhancedConvs[0].id);
          setSearchParams({ conv: enhancedConvs[0].id });
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [user, activeConversationId, setSearchParams]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Sync active partner when conversation changes, with strict privacy verification
  useEffect(() => {
    if (!activeConversationId || !user) return;

    const currentConv = conversations.find((c) => c.id === activeConversationId);
    if (currentConv && currentConv.members) {
      const otherMember = currentConv.members.find((m) => m.user_id !== user.id);
      if (otherMember?.profile) {
        setActivePartner(otherMember.profile);
        return;
      }
    }

    // Direct fallback if conversation is not yet in conversation list (strictly verifies participant membership)
    fetchDirectPartner(activeConversationId, user.id).then((p) => {
      if (p) {
        setActivePartner(p);
      }
    });
  }, [activeConversationId, conversations, user]);

  // 2. Load messages for active conversation with membership verification
  const loadMessages = useCallback(
    async (convId: string) => {
      if (!user) return;
      setIsLoadingMessages(true);
      setSendError(null);
      setUnauthorizedError(null);

      // Verify participant membership at client before loading
      const isMember = await verifyConversationMembership(convId, user.id);
      if (!isMember) {
        setIsLoadingMessages(false);
        setUnauthorizedError('Access denied: You are not an authorized participant in this private conversation.');
        setActiveConversationId(null);
        setActivePartner(null);
        setMessages([]);
        setSearchParams({});
        return;
      }

      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*, sender:sender_id(*), resource:shared_resources(*)')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setMessages(data as Message[]);
          // Update user last read
          await supabase
            .from('conversation_members')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', convId)
            .eq('user_id', user.id);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [user, setSearchParams]
  );

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages]);

  // 3. Set up Realtime subscription for incoming messages with strict membership check and deduplication
  useEffect(() => {
    if (!activeConversationId || !user) return;

    let isSubscribed = true;
    let channel: any = null;

    verifyConversationMembership(activeConversationId, user.id).then((isMember) => {
      if (!isMember || !isSubscribed) return;

      channel = supabase
        .channel(`chat:${activeConversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${activeConversationId}`,
          },
          async (payload) => {
            const newMsg = payload.new as Message;

            // Strict privacy check: ignore message if not for this active conversation
            if (newMsg.conversation_id !== activeConversationId) return;

            // Deduplication: skip if already loaded in state
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) {
                return prev;
              }
              return [...prev, newMsg];
            });

            // Fetch sender profile if not already attached
            if (newMsg.sender_id !== user.id) {
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newMsg.sender_id)
                .maybeSingle();

              if (senderProfile) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === newMsg.id ? { ...m, sender: senderProfile as Profile } : m
                  )
                );
              }
            }

            // Update conversation list item last_message preview
            setConversations((prev) =>
              prev.map((c) =>
                c.id === activeConversationId
                  ? { ...c, last_message: newMsg, updated_at: newMsg.created_at }
                  : c
              )
            );
          }
        )
        .subscribe();
    });

    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [activeConversationId, user]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  // Handle message sending with private attachment support and draft preservation
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && !selectedFile) || !activeConversationId || !user || isSending) return;

    // Verify sender ID strictly matches authenticated user
    if (!user.id) {
      setSendError('Your session has expired. Please sign in again.');
      return;
    }

    // Verify sender is an authorized participant in this conversation
    const isMember = await verifyConversationMembership(activeConversationId, user.id);
    if (!isMember) {
      setSendError('Access denied: You are not authorized to send messages in this conversation.');
      return;
    }

    const content = messageInput.trim();
    setIsSending(true);
    setSendError(null);

    try {
      // 1. Handle private attachment upload if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop() || 'dat';
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        // Storage path scoped to conversation_id/user_id/filename (matches storage RLS)
        const storagePath = `${activeConversationId}/${user.id}/${uniqueSuffix}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from('learning_resources')
          .upload(storagePath, selectedFile, { upsert: false });

        if (uploadErr) {
          console.warn('Storage upload notice:', uploadErr);
          if (uploadErr.message?.includes('bucket not found') || (uploadErr as any).statusCode === '404') {
            throw new Error('Private storage bucket is being initialized. Run migration 016 or send text messages.');
          }
          throw new Error(`Failed to upload attachment: ${uploadErr.message}`);
        }

        // Generate short-lived signed URL (300 seconds)
        const { data: signedData } = await supabase.storage
          .from('learning_resources')
          .createSignedUrl(storagePath, 300);

        // Insert shared_resource record
        await supabase
          .from('shared_resources')
          .insert({
            conversation_id: activeConversationId,
            uploader_id: user.id,
            title: selectedFile.name,
            resource_type: selectedFile.type.startsWith('image/') ? 'link' : 'file',
            url: signedData?.signedUrl || null,
            file_path: storagePath,
            file_size_bytes: selectedFile.size,
          });
      }

      // 2. Insert message record
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          sender_id: user.id,
          content: content || (selectedFile ? `Shared file: ${selectedFile.name}` : ''),
          message_type: selectedFile ? 'resource' : 'text',
        })
        .select('*, sender:sender_id(*)')
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        // Clear input and attachment ONLY on success (draft preservation)
        setMessageInput('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Deduplicate and append
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data as Message];
        });

        // Touch conversation updated_at
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', activeConversationId);

        // Update preview in conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, last_message: data as Message, updated_at: data.created_at }
              : c
          )
        );
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setSendError(err.message || 'Unable to deliver message. Please check your connection and try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Creator search for "New Message" modal
  useEffect(() => {
    if (!isNewChatModalOpen) {
      setCreatorSearchQuery('');
      setCreatorSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (!user) return;
      setIsSearchingCreators(true);

      try {
        let query = supabase
          .from('profiles')
          .select('*')
          .neq('id', user.id)
          .limit(10);

        if (creatorSearchQuery.trim()) {
          query = query.or(
            `username.ilike.%${creatorSearchQuery.trim()}%,full_name.ilike.%${creatorSearchQuery.trim()}%,display_name.ilike.%${creatorSearchQuery.trim()}%`
          );
        }

        const { data, error } = await query;
        if (!error && data) {
          setCreatorSearchResults(data as Profile[]);
        }
      } catch (err) {
        console.error('Creator search error:', err);
      } finally {
        setIsSearchingCreators(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isNewChatModalOpen, creatorSearchQuery, user]);

  const handleSelectCreatorForChat = async (targetUser: Profile) => {
    if (!user) return;

    try {
      const { conversationId, error } = await getOrCreateDirectConversation(
        user.id,
        targetUser.id
      );

      if (conversationId) {
        setActiveConversationId(conversationId);
        setActivePartner(targetUser);
        setSearchParams({ conv: conversationId });
        setIsNewChatModalOpen(false);
        loadConversations();
      } else {
        alert(error || 'Failed to start conversation. Please try again.');
      }
    } catch (err: any) {
      console.error('Error starting conversation:', err);
      alert(err.message || 'Failed to start conversation.');
    }
  };

  const handleOpenAttachment = async (filePath: string | null | undefined, originalUrl: string | null | undefined) => {
    if (!user || !activeConversationId) return;

    try {
      if (filePath) {
        // Generate a fresh 5-minute signed URL
        const { data, error } = await supabase.storage
          .from('learning_resources')
          .createSignedUrl(filePath, 300);

        if (!error && data?.signedUrl) {
          window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      }

      if (originalUrl) {
        window.open(originalUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Failed to open private attachment:', err);
      alert('Unable to generate secure download link for this attachment.');
    }
  };

  // Filter conversations list by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();

    return conversations.filter((conv) => {
      const otherMember = conv.members?.find((m) => m.user_id !== user?.id);
      const partner = otherMember?.profile;
      const usernameMatch = partner?.username?.toLowerCase().includes(q);
      const nameMatch = partner?.full_name?.toLowerCase().includes(q) || partner?.display_name?.toLowerCase().includes(q);
      const msgMatch = conv.last_message?.content?.toLowerCase().includes(q);
      return usernameMatch || nameMatch || msgMatch;
    });
  }, [conversations, searchQuery, user?.id]);

  return (
    <div className="w-full h-[calc(100vh-80px)] lg:h-[calc(100vh-48px)] flex bg-surface border border-theme rounded-[20px] overflow-hidden select-none shadow-card">
      {/* Left Conversations Sidebar */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-theme flex flex-col bg-surface ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-theme flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#FF304F]" />
              <span>Direct Messages</span>
            </h2>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="p-1.5 rounded-[8px] bg-surface-secondary hover:bg-surface-tertiary text-primary transition-colors cursor-pointer"
              title="New Message"
              aria-label="New Message"
            >
              <SquarePen className="w-4 h-4 text-[#FF304F]" />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-surface-secondary text-xs text-primary placeholder-[#9297A2] rounded-[10px] border border-theme pl-8 pr-7 py-2 focus:outline-none focus:border-[#FF304F]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-theme">
          {isLoadingList ? (
            <div className="p-6 text-xs text-muted text-center flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-[#FF304F] border-t-transparent rounded-full animate-spin" />
              <span>Loading chats...</span>
            </div>
          ) : conversations.length === 0 ? (
            /* Explicit empty state per specification */
            <div className="p-8 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#FF304F]/10 text-[#FF304F] flex items-center justify-center mb-3">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-primary mb-1">No messages yet</h3>
              <p className="text-xs text-secondary leading-relaxed mb-4 max-w-xs">
                Connect with creators to ask questions, share tutorials, and collaborate.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/explore')}
                leftIcon={<Search className="w-3.5 h-3.5" />}
              >
                Discover Creators
              </Button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted">
              No conversations found matching &quot;{searchQuery}&quot;.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const otherMember = conv.members?.find((m) => m.user_id !== user?.id);
              const partner = otherMember?.profile;
              const isActive = conv.id === activeConversationId;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                    setSearchParams({ conv: conv.id });
                  }}
                  className={`flex items-center gap-3 p-3.5 cursor-pointer transition-colors ${
                    isActive ? 'bg-surface-secondary' : 'hover:bg-surface-secondary/60'
                  }`}
                >
                  <Avatar
                    src={partner?.avatar_url}
                    name={partner?.full_name || partner?.username}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary truncate">
                        {partner?.display_name || partner?.full_name || partner?.username || 'Creator'}
                      </span>
                      <span className="text-[10px] text-muted shrink-0 ml-1">
                        {formatTimeAgo(conv.last_message?.created_at || conv.updated_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[11px] text-muted truncate">
                        {conv.last_message ? conv.last_message.content : `@${partner?.username || 'user'}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Chat Panel */}
      <div
        className={`flex-1 flex flex-col bg-app ${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeConversationId ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-theme flex items-center justify-between bg-surface">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveConversationId(null);
                    setSearchParams({});
                  }}
                  className="md:hidden text-muted hover:text-primary p-1 cursor-pointer"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div
                  onClick={() => activePartner?.username && navigate(`/u/${activePartner.username}`)}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <Avatar
                    src={activePartner?.avatar_url}
                    name={activePartner?.full_name || activePartner?.username}
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-primary group-hover:underline">
                      {activePartner?.display_name || activePartner?.full_name || activePartner?.username || 'Chat'}
                    </span>
                    <span className="text-[10px] text-muted">
                      @{activePartner?.username || 'user'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingMessages ? (
                <div className="flex flex-col items-center justify-center py-12 text-xs text-muted gap-2">
                  <div className="w-5 h-5 border-2 border-[#FF304F] border-t-transparent rounded-full animate-spin" />
                  <span>Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 text-xs text-muted leading-relaxed max-w-sm mx-auto">
                  <div className="w-10 h-10 rounded-full bg-[#FF304F]/10 text-[#FF304F] flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-primary mb-1">Start of conversation</p>
                  Say hi to start collaborating! You can discuss study roadmaps and share materials.
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[78%] sm:max-w-[70%] rounded-[16px] px-4 py-2.5 text-xs leading-relaxed select-text ${
                          isMe
                            ? 'bg-[#FF304F] text-white rounded-br-[4px]'
                            : 'bg-surface text-primary border border-theme rounded-bl-[4px]'
                        }`}
                      >
                        {/* Private Attachment Card if message is a resource */}
                        {msg.message_type === 'resource' && (
                          <div
                            onClick={() => handleOpenAttachment(msg.resource?.file_path, msg.resource?.url || null)}
                            className={`mb-2 p-2.5 rounded-[12px] border flex items-center gap-2.5 cursor-pointer transition-colors ${
                              isMe
                                ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                                : 'bg-surface-secondary hover:bg-surface-tertiary border-theme text-primary'
                            }`}
                          >
                            <FileText className={`w-4 h-4 shrink-0 ${isMe ? 'text-white' : 'text-[#FF304F]'}`} />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold block truncate">
                                {msg.resource?.title || msg.content}
                              </span>
                              <span className="text-[10px] opacity-75">Click to access attachment securely</span>
                            </div>
                            <Download className="w-3.5 h-3.5 shrink-0" />
                          </div>
                        )}
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-muted mt-1 px-1 flex items-center gap-1">
                        {formatTimeAgo(msg.created_at)}
                        {isMe && <CheckCheck className="w-3 h-3 text-[#FF304F]" />}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error banner if send failed */}
            {sendError && (
              <div className="px-4 py-2 bg-[#FF6269]/10 border-t border-[#FF6269]/20 flex items-center gap-2 text-xs text-[#FF6269]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{sendError}</span>
                <button
                  onClick={() => setSendError(null)}
                  className="text-[#FF6269] hover:underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Attachment preview chip if a file is selected */}
            {selectedFile && (
              <div className="mx-3 mb-2 p-2 rounded-[10px] bg-surface-secondary border border-theme flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip className="w-3.5 h-3.5 text-[#FF304F] shrink-0" />
                  <span className="text-xs text-primary truncate font-medium">{selectedFile.name}</span>
                  <span className="text-[10px] text-muted shrink-0">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-1 text-muted hover:text-primary cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Chat Composer */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-surface border-t border-theme flex items-center gap-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      setSendError('File exceeds 10MB maximum limit.');
                      return;
                    }
                    setSelectedFile(file);
                    setSendError(null);
                  }
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className="p-2.5 rounded-[12px] bg-surface-secondary hover:bg-surface-tertiary text-muted hover:text-primary transition-colors cursor-pointer shrink-0"
                title="Attach private file"
                aria-label="Attach file"
              >
                <Paperclip className="w-4 h-4 text-[#FF304F]" />
              </button>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={selectedFile ? 'Add a note with this file (optional)...' : 'Write a message...'}
                disabled={isSending}
                className="flex-1 bg-surface-secondary text-xs text-primary placeholder-[#9297A2] rounded-[12px] border border-theme px-3.5 py-2.5 focus:outline-none focus:border-[#FF304F]"
              />
              <button
                type="submit"
                disabled={(!messageInput.trim() && !selectedFile) || isSending}
                className="p-2.5 rounded-[12px] bg-[#FF304F] hover:bg-[#E5203F] text-white disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted">
            {unauthorizedError ? (
              <div className="max-w-sm flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-[#FF6269]/15 text-[#FF6269] flex items-center justify-center mb-3">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-semibold text-primary mb-1">Access Restricted</h3>
                <p className="text-xs text-secondary leading-relaxed mb-4">{unauthorizedError}</p>
                <Button variant="secondary" size="sm" onClick={() => setUnauthorizedError(null)}>
                  Return to Messages
                </Button>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center mb-3">
                  <MessageCircle className="w-8 h-8 text-[#FF304F]" />
                </div>
                <h3 className="text-sm font-semibold text-primary mb-1">Your Messages</h3>
                <p className="text-xs max-w-xs leading-relaxed mb-4">
                  Send private messages to ask questions about tutorials or coordinate peer-learning sessions.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsNewChatModalOpen(true)}
                  leftIcon={<SquarePen className="w-3.5 h-3.5 text-[#FF304F]" />}
                >
                  New Message
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* New Message Creator Search Modal */}
      <Dialog
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        title="New Message"
        maxWidth="sm"
      >
        <div className="flex flex-col gap-3 p-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={creatorSearchQuery}
              onChange={(e) => setCreatorSearchQuery(e.target.value)}
              placeholder="Search by username or name..."
              autoFocus
              className="w-full bg-surface-secondary text-xs text-primary placeholder-[#9297A2] rounded-[10px] border border-theme pl-8 pr-3 py-2 focus:outline-none focus:border-[#FF304F]"
            />
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-theme">
            {isSearchingCreators ? (
              <div className="py-6 text-center text-xs text-muted">Searching creators...</div>
            ) : creatorSearchResults.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted">
                {creatorSearchQuery.trim() ? 'No users found.' : 'Search for a creator to start chatting.'}
              </div>
            ) : (
              creatorSearchResults.map((creator) => (
                <div
                  key={creator.id}
                  onClick={() => handleSelectCreatorForChat(creator)}
                  className="flex items-center gap-3 p-2.5 rounded-[10px] hover:bg-surface-secondary transition-colors cursor-pointer"
                >
                  <Avatar
                    src={creator.avatar_url}
                    name={creator.full_name || creator.username}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-primary block truncate">
                      {creator.display_name || creator.full_name || creator.username}
                    </span>
                    <span className="text-[10px] text-muted block truncate">
                      @{creator.username}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};
