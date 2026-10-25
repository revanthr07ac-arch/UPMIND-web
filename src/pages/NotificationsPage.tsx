import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  GraduationCap,
  Check,
} from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { EmptyState } from '../components/common/EmptyState';
import { formatTimeAgo } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Notification } from '../types/database';

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, actor:actor_id(*)')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40);

      if (!error && data) {
        setNotifications(data as Notification[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', user.id);

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (_) {}
  };

  const handleNotificationClick = async (notif: Notification) => {
    // Mark this notification as read
    if (!notif.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notif.id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }

    // Navigate depending on type
    if (
      notif.type === 'learning_request_new' ||
      notif.type === 'learning_request_accepted' ||
      notif.type === 'learning_request_declined' ||
      notif.type === 'learning_request_completed'
    ) {
      navigate('/learn');
    } else if (notif.type === 'new_message') {
      navigate(`/messages?conv=${notif.related_entity_id || ''}`);
    } else if (notif.type === 'follow' && notif.actor) {
      navigate(`/u/${notif.actor.username}`);
    } else {
      navigate('/');
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-3.5 h-3.5 fill-[#E5484D] text-[#E5484D]" />;
      case 'comment':
        return <MessageCircle className="w-3.5 h-3.5 text-[#70A7FF]" />;
      case 'follow':
        return <UserPlus className="w-3.5 h-3.5 text-[#35B883]" />;
      case 'learning_request_new':
      case 'learning_request_accepted':
      case 'learning_request_completed':
        return <GraduationCap className="w-3.5 h-3.5 text-[#E5484D]" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-[#B0B3BD]" />;
    }
  };

  const getNotificationText = (notif: Notification) => {
    const actorName =
      notif.actor?.display_name || notif.actor?.full_name || notif.actor?.username || 'Someone';

    switch (notif.type) {
      case 'like':
        return <><strong>{actorName}</strong> liked your post.</>;
      case 'comment':
        return <><strong>{actorName}</strong> commented on your post.</>;
      case 'follow':
        return <><strong>{actorName}</strong> started following you.</>;
      case 'learning_request_new':
        return <><strong>{actorName}</strong> requested learning materials from your tutorial.</>;
      case 'learning_request_accepted':
        return <><strong>{actorName}</strong> accepted your learning request!</>;
      case 'learning_request_completed':
        return <><strong>{actorName}</strong> fulfilled your learning request with resources!</>;
      case 'new_message':
        return <><strong>{actorName}</strong> sent you a direct message.</>;
      default:
        return <>New activity from <strong>{actorName}</strong>.</>;
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-[#292B34]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-[#15161B] border border-[#292B34] flex items-center justify-center text-[#E5484D]">
            <Bell className="w-4 h-4" />
          </div>
          <h1 className="text-xl font-bold text-[#F5F5F7]">Notifications</h1>
        </div>

        {notifications.some((n) => !n.is_read) && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#E5484D] hover:text-[#FF7479] transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-[#858995]">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-6 h-6 text-[#858995]" />}
            title="No notifications yet"
            description="When users like your posts, follow your profile, or send learning requests, you'll see them right here."
          />
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`flex items-center justify-between p-3.5 rounded-[14px] border cursor-pointer transition-all ${
                notif.is_read
                  ? 'bg-[#15161B]/60 border-[#292B34]/60 hover:bg-[#15161B]'
                  : 'bg-[#1B1D24] border-[#E5484D]/30 shadow-xs hover:border-[#E5484D]/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <Avatar
                    src={notif.actor?.avatar_url}
                    name={notif.actor?.username}
                    size="md"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#15161B] border border-[#292B34] flex items-center justify-center">
                    {getNotificationIcon(notif.type)}
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-[#F5F5F7] leading-relaxed">
                    {getNotificationText(notif)}
                  </span>
                  <span className="text-[10px] text-[#858995] mt-0.5">
                    {formatTimeAgo(notif.created_at)}
                  </span>
                </div>
              </div>

              {!notif.is_read && (
                <span className="w-2 h-2 rounded-full bg-[#E5484D] shrink-0 ml-3" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
