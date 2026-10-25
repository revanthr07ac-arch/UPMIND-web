import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variants = {
    primary:
      'bg-[#E5484D] hover:bg-[#D7373F] active:bg-[#BE3038] text-white shadow-sm focus-visible:outline-[#FF7479]',
    secondary:
      'bg-[#1B1D24] hover:bg-[#282A32] text-[#F5F5F7] border border-[#292B34] hover:border-[#393C47] focus-visible:outline-[#FF7479]',
    ghost:
      'bg-transparent hover:bg-[#1B1D24] text-[#B0B3BD] hover:text-[#F5F5F7] focus-visible:outline-[#FF7479]',
    destructive:
      'bg-[#FF6269]/10 text-[#FF6269] hover:bg-[#FF6269]/20 border border-[#FF6269]/30 focus-visible:outline-[#FF6269]',
    outline:
      'bg-transparent border border-[#E5484D] text-[#E5484D] hover:bg-[#E5484D]/10 focus-visible:outline-[#FF7479]',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 rounded-[8px] gap-1.5',
    md: 'text-sm px-4 py-2 rounded-[12px] gap-2',
    lg: 'text-base px-5 py-2.5 rounded-[12px] gap-2.5',
    icon: 'p-2 rounded-[12px]',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
