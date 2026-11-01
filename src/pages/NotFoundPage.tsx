import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 select-none">
      <div className="w-16 h-16 rounded-full bg-surface border border-theme flex items-center justify-center text-[#FF304F] mb-4">
        <Compass className="w-8 h-8" />
      </div>
      <h1 className="text-xl font-bold text-primary mb-1">Page Not Found</h1>
      <p className="text-xs text-secondary max-w-sm mb-6 leading-relaxed">
        The link you followed may be broken, or the page may have been removed.
      </p>
      <Button variant="primary" size="md" onClick={() => navigate('/')}>
        Back to Home Feed
      </Button>
    </div>
  );
};
