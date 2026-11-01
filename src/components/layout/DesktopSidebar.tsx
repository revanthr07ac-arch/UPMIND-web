import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Compass,
  Film,
  GraduationCap,
  MessageCircle,
  Bell,
  Users,
  PlusSquare,
  Bookmark,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../common/Avatar';

interface DesktopSidebarProps {
  onOpenCreateModal: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ onOpenCreateModal }) => {
  const { profile, unreadNotificationsCount, unreadMessagesCount, signOut } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Explore', path: '/explore', icon: Compass },
    { label: 'Reels', path: '/reels', icon: Film },
    { label: 'Learn', path: '/learn', icon: GraduationCap, highlight: true },
    {
      label: 'Messages',
      path: '/messages',
      icon: MessageCircle,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    },
    {
      label: 'Notifications',
      path: '/notifications',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    { label: 'Communities', path: '/communities', icon: Users },
    { label: 'Saved', path: '/saved', icon: Bookmark },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 h-screen sticky top-0 bg-app border-r border-theme px-4 py-6 justify-between select-none z-30 shrink-0">
      <div className="flex flex-col gap-6">
        {/* Brand Logo */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-[10px] bg-surface border border-theme flex items-center justify-center text-primary group-hover:border-[#FF304F] transition-colors shadow-xs">
            <span className="font-extrabold text-lg text-primary flex items-center">
              U<span className="text-[#FF304F] font-black">.</span>
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-primary">UPMIND</span>
            <span className="text-[10px] font-medium text-muted -mt-1 tracking-wider uppercase">
              Learn • Create • Connect
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-3 rounded-[12px] text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-surface-secondary text-primary font-semibold border-l-3 border-[#FF304F]'
                      : 'text-secondary hover:text-primary hover:bg-surface-secondary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3.5">
                      <Icon
                        className={`w-5 h-5 transition-colors ${
                          isActive
                            ? 'text-[#FF304F]'
                            : item.highlight
                            ? 'text-primary'
                            : 'text-muted'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="bg-[#FF304F] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Profile Nav Item */}
          <NavLink
            to={profile?.username ? `/u/${profile.username}` : '/login'}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-3.5 py-3 rounded-[12px] text-sm font-medium transition-all ${
                isActive
                  ? 'bg-surface-secondary text-primary font-semibold border-l-3 border-[#FF304F]'
                  : 'text-secondary hover:text-primary hover:bg-surface-secondary'
              }`
            }
          >
            <Avatar
              src={profile?.avatar_url}
              name={profile?.full_name || profile?.username}
              size="xs"
            />
            <span>Profile</span>
          </NavLink>

          {/* Create Post Action Button */}
          <div className="pt-2">
            <button
              onClick={onOpenCreateModal}
              className="w-full flex items-center justify-center gap-2.5 bg-[#FF304F] hover:bg-[#E52543] active:bg-[#CC1B36] text-white py-2.5 px-4 rounded-[12px] text-sm font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <PlusSquare className="w-4 h-4" />
              <span>Create Post</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Footer Navigation (Settings & Logout) */}
      <div className="flex flex-col gap-1 pt-4 border-t border-theme">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-medium transition-colors ${
              isActive
                ? 'bg-surface-secondary text-primary font-semibold'
                : 'text-muted hover:text-primary hover:bg-surface-secondary'
            }`
          }
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </NavLink>

        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] text-xs font-medium text-[#FF6269] hover:bg-[#FF6269]/10 transition-colors text-left cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
