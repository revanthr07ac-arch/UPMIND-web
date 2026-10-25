import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const MobileHeader: React.FC = () => {
  const navigate = useNavigate();
  const { unreadNotificationsCount, unreadMessagesCount } = useAuth();

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-[#0B0C0F]/90 backdrop-blur-md border-b border-[#292B34] px-4 py-3 flex items-center justify-between select-none">
      {/* Brand */}
      <div onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer">
        <span className="font-extrabold text-xl tracking-tight text-[#F5F5F7] flex items-center">
          UPMIND
          <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D] ml-0.5 inline-block" />
        </span>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/learn')}
          aria-label="Learning Hub"
          className="p-2 text-[#B0B3BD] hover:text-[#F5F5F7] hover:bg-[#15161B] rounded-[10px] transition-colors relative"
        >
          <GraduationCap className="w-5 h-5 text-[#E5484D]" />
        </button>

        <button
          onClick={() => navigate('/notifications')}
          aria-label="Notifications"
          className="p-2 text-[#B0B3BD] hover:text-[#F5F5F7] hover:bg-[#15161B] rounded-[10px] transition-colors relative"
        >
          <Bell className="w-5 h-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E5484D]" />
          )}
        </button>

        <button
          onClick={() => navigate('/messages')}
          aria-label="Direct Messages"
          className="p-2 text-[#B0B3BD] hover:text-[#F5F5F7] hover:bg-[#15161B] rounded-[10px] transition-colors relative"
        >
          <MessageCircle className="w-5 h-5" />
          {unreadMessagesCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E5484D]" />
          )}
        </button>
      </div>
    </header>
  );
};
