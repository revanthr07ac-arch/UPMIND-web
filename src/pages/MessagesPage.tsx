import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send,
  MessageCircle,
  ArrowLeft,
  CheckCheck,
  Search,
} from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { formatTimeAgo } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Conversation, Message, Profile } from '../types/database';

export const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConvIdFromUrl = searchParams.get('conv');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    activeConvIdFromUrl
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [activePartner, setActivePartner] = useState<Profile | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Load user's conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setIsLoadingList(true);

    try {
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
      const { data: convData } = await supabase
        .from('conversations')
        .select('*, members:conversation_members(*, profile:user_id(*))')
        .in('id', convIds)
        .order('updated_at', { ascending: false });

      if (convData) {
        setConversations(convData as Conversation[]);
        if (!activeConversationId && convData.length > 0) {
          setActiveConversationId(convData[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingList(false);
    }
  }, [user, activeConversationId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Sync active partner when conversation changes
  useEffect(() => {
    if (!activeConversationId || conversations.length === 0) return;
    const currentConv = conversations.find((c) => c.id === activeConversationId);
    if (currentConv && currentConv.members) {
      const otherMember = currentConv.members.find((m) => m.user_id !== user?.id);
      if (otherMember?.profile) {
        setActivePartner(otherMember.profile);
      }
    }
  }, [activeConversationId, conversations, user]);

  // 2. Load messages for active conversation
  const loadMessages = useCallback(async (convId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:sender_id(*)')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data as Message[]);
        // Update user last read
        if (user) {
          await supabase
            .from('conversation_members')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', convId)
            .eq('user_id', user.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages]);

  // 3. Set up Realtime subscription for incoming messages
  useEffect(() => {
    if (!activeConversationId) return;

    const channel = supabase
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
          // Fetch sender profile
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .maybeSingle();

          setMessages((prev) => [
            ...prev,
            { ...newMsg, sender: senderProfile as Profile },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConversationId || !user) return;

    const content = messageInput.trim();
    setMessageInput('');
    setIsSending(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          sender_id: user.id,
          content,
          message_type: 'text',
        })
        .select('*, sender:sender_id(*)')
        .single();

      if (!error && data) {
        setMessages((prev) => [...prev, data as Message]);

        // Touch conversation updated_at
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', activeConversationId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-80px)] lg:h-[calc(100vh-48px)] flex bg-[#15161B] border border-[#292B34] rounded-[20px] overflow-hidden select-none">
      {/* Left Conversations Sidebar */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-[#292B34] flex flex-col bg-[#0B0C0F] ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-[#292B34] flex flex-col gap-3">
          <h2 className="text-base font-bold text-[#F5F5F7] flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#E5484D]" />
            <span>Direct Messages</span>
          </h2>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#858995] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full bg-[#15161B] text-xs text-[#F5F5F7] placeholder-[#858995] rounded-[10px] border border-[#292B34] pl-8 pr-3 py-2 focus:outline-none focus:border-[#FF7479]"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#292B34]/40">
          {isLoadingList ? (
            <div className="p-4 text-xs text-[#858995] text-center">Loading chats...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#858995]">
              No conversations yet. Connect with a creator from their profile or a learning request!
            </div>
          ) : (
            conversations.map((conv) => {
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
                    isActive ? 'bg-[#1B1D24]' : 'hover:bg-[#15161B]'
                  }`}
                >
                  <Avatar
                    src={partner?.avatar_url}
                    name={partner?.full_name || partner?.username}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#F5F5F7] truncate">
                        {partner?.display_name || partner?.username || 'Member'}
                      </span>
                      <span className="text-[10px] text-[#858995]">
                        {formatTimeAgo(conv.updated_at)}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#858995] truncate block mt-0.5">
                      @{partner?.username}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Chat Panel */}
      <div
        className={`flex-1 flex flex-col bg-[#15161B] ${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeConversationId ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-[#292B34] flex items-center justify-between bg-[#101116]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveConversationId(null)}
                  className="md:hidden text-[#858995] hover:text-white p-1"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <Avatar
                  src={activePartner?.avatar_url}
                  name={activePartner?.full_name || activePartner?.username}
                  size="sm"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#F5F5F7]">
                    {activePartner?.display_name || activePartner?.username || 'Chat'}
                  </span>
                  <span className="text-[10px] text-[#35B883] font-medium">Active</span>
                </div>
              </div>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingMessages ? (
                <div className="text-center py-10 text-xs text-[#858995]">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 text-xs text-[#858995] leading-relaxed">
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
                        className={`max-w-[75%] rounded-[16px] px-4 py-2.5 text-xs leading-relaxed select-text ${
                          isMe
                            ? 'bg-[#E5484D] text-white rounded-br-[4px]'
                            : 'bg-[#1B1D24] text-[#F5F5F7] border border-[#292B34] rounded-bl-[4px]'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-[#858995] mt-1 px-1 flex items-center gap-1">
                        {formatTimeAgo(msg.created_at)}
                        {isMe && <CheckCheck className="w-3 h-3 text-[#E5484D]" />}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Composer */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-[#101116] border-t border-[#292B34] flex items-center gap-2"
            >
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Message..."
                className="flex-1 bg-[#1B1D24] text-xs text-[#F5F5F7] placeholder-[#858995] rounded-[12px] border border-[#292B34] px-3.5 py-2.5 focus:outline-none focus:border-[#FF7479]"
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || isSending}
                className="p-2.5 rounded-[12px] bg-[#E5484D] hover:bg-[#D7373F] text-white disabled:opacity-40 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#858995]">
            <div className="w-16 h-16 rounded-full bg-[#1B1D24] flex items-center justify-center mb-3">
              <MessageCircle className="w-8 h-8 text-[#858995]" />
            </div>
            <h3 className="text-sm font-semibold text-[#F5F5F7] mb-1">Your Messages</h3>
            <p className="text-xs max-w-xs leading-relaxed">
              Send private messages to ask questions about tutorials or coordinate peer-learning sessions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
