import React from 'react';
import { getInitials } from '../../lib/utils';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  hasStory?: boolean;
  isStorySeen?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  hasStory = false,
  isStorySeen = false,
  className = '',
  onClick,
}) => {
  const [imageError, setImageError] = React.useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-2xl',
  };

  const storyPadding = {
    xs: 'p-[1.5px]',
    sm: 'p-[2px]',
    md: 'p-[2px]',
    lg: 'p-[2.5px]',
    xl: 'p-[3px]',
    '2xl': 'p-[4px]',
  };

  const initials = getInitials(name);

  const innerAvatar = (
    <div
      className={`rounded-full overflow-hidden flex items-center justify-center font-semibold bg-[#23252D] text-[#F5F5F7] border border-[#292B34] select-none ${
        sizeClasses[size]
      } ${className}`}
      onClick={onClick}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );

  if (!hasStory) {
    return innerAvatar;
  }

  const ringStyle = isStorySeen
    ? 'bg-[#393C47]'
    : 'bg-gradient-to-tr from-[#E5484D] via-[#FF7479] to-[#BE3038]';

  return (
    <div
      className={`inline-block rounded-full ${storyPadding[size]} ${ringStyle} cursor-pointer transition-transform hover:scale-105 active:scale-95`}
      onClick={onClick}
    >
      <div className="rounded-full bg-[#0B0C0F] p-[1.5px] flex items-center justify-center">
        {innerAvatar}
      </div>
    </div>
  );
};
