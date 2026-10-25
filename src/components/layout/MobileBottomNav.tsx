import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, PlusSquare, Film } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../common/Avatar';

interface MobileBottomNavProps {
  onOpenCreateModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenCreateModal }) => {
  const { profile } = useAuth();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0C0F]/95 backdrop-blur-md border-t border-[#292B34] px-4 py-2 flex items-center justify-around select-none">
      <NavLink
        to="/"
        className={({ isActive }) =>
          `p-2.5 rounded-[12px] flex flex-col items-center gap-1 transition-colors ${
            isActive ? 'text-[#E5484D]' : 'text-[#858995] hover:text-[#F5F5F7]'
          }`
        }
      >
        <Home className="w-5 h-5" />
      </NavLink>

      <NavLink
        to="/explore"
        className={({ isActive }) =>
          `p-2.5 rounded-[12px] flex flex-col items-center gap-1 transition-colors ${
            isActive ? 'text-[#E5484D]' : 'text-[#858995] hover:text-[#F5F5F7]'
          }`
        }
      >
        <Compass className="w-5 h-5" />
      </NavLink>

      {/* Central Create Button */}
      <button
        onClick={onOpenCreateModal}
        aria-label="Create Post"
        className="p-2.5 text-[#E5484D] hover:text-[#FF7479] active:scale-90 transition-transform"
      >
        <PlusSquare className="w-6 h-6" />
      </button>

      <NavLink
        to="/reels"
        className={({ isActive }) =>
          `p-2.5 rounded-[12px] flex flex-col items-center gap-1 transition-colors ${
            isActive ? 'text-[#E5484D]' : 'text-[#858995] hover:text-[#F5F5F7]'
          }`
        }
      >
        <Film className="w-5 h-5" />
      </NavLink>

      <NavLink
        to={profile?.username ? `/u/${profile.username}` : '/login'}
        className={({ isActive }) =>
          `p-2 rounded-full border-2 transition-all ${
            isActive ? 'border-[#E5484D]' : 'border-transparent'
          }`
        }
      >
        <Avatar
          src={profile?.avatar_url}
          name={profile?.full_name || profile?.username}
          size="xs"
        />
      </NavLink>
    </nav>
  );
};
