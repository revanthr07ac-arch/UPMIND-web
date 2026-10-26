import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { RightSidebar } from './RightSidebar';
import { PostComposer } from '../feed/PostComposer';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [initialPostType, setInitialPostType] = useState<'image' | 'tutorial' | 'reel' | 'text'>('image');
  const location = useLocation();

  useEffect(() => {
    const handleOpenCreate = (e: Event) => {
      const customEvent = e as CustomEvent<{ defaultType?: 'image' | 'tutorial' | 'reel' | 'text' }>;
      if (customEvent.detail?.defaultType) {
        setInitialPostType(customEvent.detail.defaultType);
      } else {
        setInitialPostType('image');
      }
      setIsCreateOpen(true);
    };

    window.addEventListener('upmind:openCreatePost', handleOpenCreate);
    return () => window.removeEventListener('upmind:openCreatePost', handleOpenCreate);
  }, []);

  // Pages where right sidebar should be hidden for maximum focus
  const isFullWidthPage =
    location.pathname.startsWith('/messages') ||
    location.pathname.startsWith('/reels') ||
    location.pathname.startsWith('/settings');

  return (
    <div className="min-h-screen bg-[#0B0C0F] text-[#F5F5F7] flex flex-col antialiased">
      {/* Top Header for Mobile & Tablet */}
      <MobileHeader />

      <div className="flex-1 w-full max-w-[1440px] mx-auto flex">
        {/* Left Desktop Sidebar */}
        <DesktopSidebar
          onOpenCreateModal={() => {
            setInitialPostType('image');
            setIsCreateOpen(true);
          }}
        />

        {/* Central Content Column */}
        <main
          className={`flex-1 min-w-0 pb-20 lg:pb-8 px-3 sm:px-6 pt-4 sm:pt-6 ${
            isFullWidthPage ? 'max-w-none' : 'max-w-3xl xl:max-w-2xl 2xl:max-w-3xl'
          }`}
        >
          {children}
        </main>

        {/* Right Sidebar on Desktop (hidden on full-width pages) */}
        {!isFullWidthPage && <RightSidebar />}
      </div>

      {/* Bottom Bar for Mobile & Tablet */}
      <MobileBottomNav
        onOpenCreateModal={() => {
          setInitialPostType('image');
          setIsCreateOpen(true);
        }}
      />

      {/* Global Post Composer */}
      <PostComposer
        isOpen={isCreateOpen}
        defaultPostType={initialPostType}
        onClose={() => setIsCreateOpen(false)}
        onPostCreated={() => {
          // Trigger custom event so active feed can refresh
          window.dispatchEvent(new CustomEvent('upmind:refreshFeed'));
        }}
      />
    </div>
  );
};
