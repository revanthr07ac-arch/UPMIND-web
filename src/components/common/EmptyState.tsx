import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-theme rounded-[16px] bg-surface/50 my-4">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-surface-secondary text-muted flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-primary mb-1">{title}</h3>
      <p className="text-xs text-muted max-w-sm mb-4 leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs font-semibold text-white bg-[#FF304F] hover:bg-[#E52543] active:bg-[#CC1B36] px-4 py-2 rounded-[8px] transition-colors cursor-pointer shadow-xs"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export const PostSkeleton: React.FC = () => {
  return (
    <div className="w-full bg-surface border border-theme rounded-[16px] p-4 mb-4 animate-pulse shadow-xs">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-surface-tertiary" />
        <div className="flex-1 space-y-1.5">
          <div className="w-24 h-3 bg-surface-tertiary rounded" />
          <div className="w-16 h-2 bg-surface-secondary rounded" />
        </div>
      </div>
      <div className="w-full aspect-square bg-surface-secondary rounded-[12px] mb-3" />
      <div className="space-y-2">
        <div className="w-3/4 h-3 bg-surface-tertiary rounded" />
        <div className="w-1/2 h-2.5 bg-surface-secondary rounded" />
      </div>
    </div>
  );
};
