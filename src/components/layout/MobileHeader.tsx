import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const MobileHeader: React.FC = () => {
  const navigate = useNavigate();
  const { unreadNotificationsCount, unreadMessagesCount } = useAuth();

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-app/90 backdrop-blur-md border-b border-theme px-4 py-3 flex items-center justify-between select-none">
      {/* Brand */}
      <div onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer">
        <span className="font-extrabold text-xl tracking-tight text-primary flex items-center">
          UPMIND
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF304F] ml-0.5 inline-block" />
        </span>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/learn')}
          aria-label="Learning Hub"
          className="p-2 text-secondary hover:text-primary hover:bg-surface-secondary rounded-[10px] transition-colors relative cursor-pointer"
        >
          <GraduationCap className="w-5 h-5 text-[#FF304F]" />
        </button>

        <button
          onClick={() => navigate('/notifications')}
          aria-label="Notifications"
          className="p-2 text-secondary hover:text-primary hover:bg-surface-secondary rounded-[10px] transition-colors relative cursor-pointer"
        >
          <Bell className="w-5 h-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF304F]" />
          )}
        </button>

        <button
          onClick={() => navigate('/messages')}
          aria-label="Direct Messages"
          className="p-2 text-secondary hover:text-primary hover:bg-surface-secondary rounded-[10px] transition-colors relative cursor-pointer"
        >
          <MessageCircle className="w-5 h-5" />
          {unreadMessagesCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF304F]" />
          )}
        </button>
      </div>
    </header>
  );
};
