import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Shield,
  Bell,
  LogOut,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Sun,
  Moon,
  Check,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Dialog } from '../components/common/Dialog';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

export const SettingsPage: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Preference toggles
  const [allowDirectMessages, setAllowDirectMessages] = useState(true);
  const [showLearningBadge, setShowLearningBadge] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm.');
      return;
    }

    if (!user) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Delete user's public profile (which cascades through database foreign keys)
      await supabase.from('profiles').delete().eq('id', user.id);
      await signOut();
      navigate('/login');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 select-none">
      <div className="pb-3 border-b border-theme">
        <h1 className="text-xl font-bold text-primary">Settings & Privacy</h1>
        <p className="text-xs text-muted mt-1">
          Manage your account preferences, appearance, notifications, security, and data privacy.
        </p>
      </div>

      {/* APPEARANCE Section */}
      <div className="bg-surface border border-theme rounded-[16px] p-5 flex flex-col gap-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <Sun className="w-4 h-4 text-[#FF304F]" />
            <span>APPEARANCE</span>
          </h2>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {theme === 'light' ? 'Light Mode Active' : 'Dark Mode Active'}
          </span>
        </div>

        <p className="text-xs text-muted leading-relaxed -mt-1">
          Customize how UPMIND looks on your screen. Light Mode is the default clean interface, while Dark Mode is comfortable in dim environments.
        </p>

        {/* 2 Selectable Options: LIGHT MODE and DARK MODE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Theme selection">
          {/* Light Mode Card */}
          <button
            type="button"
            role="radio"
            aria-checked={theme === 'light'}
            onClick={() => setTheme('light')}
            className={`p-4 rounded-[14px] border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer relative ${
              theme === 'light'
                ? 'bg-surface-secondary border-[#FF304F] ring-2 ring-[#FF304F]/20 shadow-sm'
                : 'bg-surface-secondary/40 border-theme hover:border-theme-strong hover:bg-surface-secondary/70'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-[10px] bg-white border border-[#E8EAF0] shadow-xs flex items-center justify-center text-[#FF304F]">
                <Sun className="w-5 h-5" />
              </div>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                  theme === 'light'
                    ? 'bg-[#FF304F] text-white shadow-xs'
                    : 'border border-theme bg-transparent'
                }`}
              >
                {theme === 'light' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary">LIGHT MODE</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[5px] bg-[#FF304F]/10 text-[#FF304F] uppercase tracking-wider">
                  Default
                </span>
              </div>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                Clean and bright appearance. White background and light surfaces.
              </p>
            </div>
          </button>

          {/* Dark Mode Card */}
          <button
            type="button"
            role="radio"
            aria-checked={theme === 'dark'}
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-[14px] border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer relative ${
              theme === 'dark'
                ? 'bg-surface-secondary border-[#FF304F] ring-2 ring-[#FF304F]/20 shadow-sm'
                : 'bg-surface-secondary/40 border-theme hover:border-theme-strong hover:bg-surface-secondary/70'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-[10px] bg-[#1C1C1F] border border-[#34343A] shadow-xs flex items-center justify-center text-[#FF304F]">
                <Moon className="w-5 h-5" />
              </div>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#FF304F] text-white shadow-xs'
                    : 'border border-theme bg-transparent'
                }`}
              >
                {theme === 'dark' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>

            <div>
              <span className="text-sm font-bold text-primary">DARK MODE</span>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                Comfortable appearance for low-light environments. Dark backgrounds and readable light text.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Account Section */}
      <div className="bg-surface border border-theme rounded-[16px] p-5 flex flex-col gap-4 shadow-card">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <User className="w-4 h-4 text-[#FF304F]" />
          <span>Account Information</span>
        </h2>

        <div className="flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-[10px] bg-surface-secondary">
            <span className="text-muted">Username</span>
            <span className="font-semibold text-primary">@{profile?.username}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-[10px] bg-surface-secondary">
            <span className="text-muted">Email</span>
            <span className="font-semibold text-primary">{user?.email}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-[10px] bg-surface-secondary">
            <span className="text-muted">Experience Level</span>
            <span className="font-semibold text-[#FF304F] uppercase tracking-wider text-[10px]">
              {profile?.experience_level || 'beginner'}
            </span>
          </div>
        </div>
      </div>

      {/* Privacy & Learning Requests Section */}
      <div className="bg-surface border border-theme rounded-[16px] p-5 flex flex-col gap-4 shadow-card">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#FF304F]" />
          <span>Privacy & Peer Learning Preferences</span>
        </h2>

        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between p-3 rounded-[10px] bg-surface-secondary cursor-pointer">
            <div className="flex flex-col pr-4">
              <span className="text-xs font-semibold text-primary">
                Allow Direct Messages
              </span>
              <span className="text-[11px] text-muted mt-0.5">
                Let learners reach out to coordinate skill practice sessions.
              </span>
            </div>
            <input
              type="checkbox"
              checked={allowDirectMessages}
              onChange={(e) => setAllowDirectMessages(e.target.checked)}
              className="accent-[#FF304F] w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-[10px] bg-surface-secondary cursor-pointer">
            <div className="flex flex-col pr-4">
              <span className="text-xs font-semibold text-primary">
                Display &ldquo;Mentor / Learner&rdquo; Badge
              </span>
              <span className="text-[11px] text-muted mt-0.5">
                Show whether you can teach or want to learn skills on your profile card.
              </span>
            </div>
            <input
              type="checkbox"
              checked={showLearningBadge}
              onChange={(e) => setShowLearningBadge(e.target.checked)}
              className="accent-[#FF304F] w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-[10px] bg-surface-secondary cursor-pointer">
            <div className="flex flex-col pr-4">
              <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-[#FF304F]" />
                <span>Learning Request Email Notifications</span>
              </span>
              <span className="text-[11px] text-muted mt-0.5">
                Receive email alerts when learners request materials from your tutorial posts.
              </span>
            </div>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="accent-[#FF304F] w-4 h-4 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Community Guidelines & Safety */}
      <div className="bg-surface border border-theme rounded-[16px] p-5 flex flex-col gap-3 text-xs leading-relaxed text-secondary shadow-card">
        <h2 className="text-sm font-bold text-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#35B883]" />
          <span>UPMIND Peer Learning Pledge</span>
        </h2>
        <p>
          UPMIND is dedicated to free, accessible, and respectful skill sharing. All shared resources, notes, and tutorial materials must remain 100% free of charge.
        </p>
        <p>
          Harassment, spam, copyright infringement, or predatory monetization are strictly prohibited and will result in immediate profile suspension.
        </p>
      </div>

      {/* Danger Zone */}
      <div className="bg-surface border border-[#FF6269]/30 rounded-[16px] p-5 flex flex-col gap-4 shadow-card">
        <h2 className="text-sm font-bold text-[#FF6269] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Danger Zone</span>
        </h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-[10px] bg-surface-secondary">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-primary">Sign Out</span>
            <span className="text-[11px] text-muted">
              Log out of your current session on this device.
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={signOut}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            Sign Out
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-[10px] bg-[#FF6269]/10 border border-[#FF6269]/20">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#FF6269]">
              Delete Account
            </span>
            <span className="text-[11px] text-[#FF6269]/80">
              Permanently delete your profile, posts, learning requests, and all account data.
            </span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete Account
          </Button>
        </div>
      </div>

      {/* Explicit Account Deletion Modal */}
      <Dialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Permanently Delete Account"
        maxWidth="sm"
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-[10px] bg-[#FF6269]/10 border border-[#FF6269]/30 text-xs text-[#FF6269]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              This action cannot be undone. All your posts, followers, chats, and shared resources will be wiped permanently.
            </span>
          </div>

          <p className="text-xs text-muted">
            Type <strong className="text-primary">DELETE</strong> below to confirm account removal:
          </p>

          <input
            type="text"
            value={deleteConfirmationText}
            onChange={(e) => setDeleteConfirmationText(e.target.value)}
            placeholder="Type DELETE"
            className="w-full bg-surface-secondary text-primary text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF6269] focus:outline-none"
          />

          {deleteError && <span className="text-xs text-[#FF6269]">{deleteError}</span>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDeleteAccount}
            >
              Confirm Deletion
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
