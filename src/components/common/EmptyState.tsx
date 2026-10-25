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
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-[#292B34] rounded-[16px] bg-[#101116]/50 my-4">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-[#1B1D24] text-[#858995] flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-[#F5F5F7] mb-1">{title}</h3>
      <p className="text-xs text-[#858995] max-w-sm mb-4 leading-relaxed">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs font-medium text-white bg-[#E5484D] hover:bg-[#D7373F] px-4 py-2 rounded-[8px] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export const PostSkeleton: React.FC = () => {
  return (
    <div className="w-full bg-[#15161B] border border-[#292B34] rounded-[16px] p-4 mb-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#23252D]" />
        <div className="flex-1 space-y-1.5">
          <div className="w-24 h-3 bg-[#23252D] rounded" />
          <div className="w-16 h-2 bg-[#1B1D24] rounded" />
        </div>
      </div>
      <div className="w-full aspect-square bg-[#1B1D24] rounded-[12px] mb-3" />
      <div className="space-y-2">
        <div className="w-3/4 h-3 bg-[#23252D] rounded" />
        <div className="w-1/2 h-2.5 bg-[#1B1D24] rounded" />
      </div>
    </div>
  );
};
