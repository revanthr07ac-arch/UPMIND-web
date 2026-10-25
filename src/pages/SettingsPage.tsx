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
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Dialog } from '../components/common/Dialog';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export const SettingsPage: React.FC = () => {
  const { user, profile, signOut } = useAuth();
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
      <div className="pb-3 border-b border-[#292B34]">
        <h1 className="text-xl font-bold text-[#F5F5F7]">Settings & Privacy</h1>
        <p className="text-xs text-[#858995] mt-1">
          Manage your account preferences, notifications, security, and data privacy.
        </p>
      </div>

      {/* Account Section */}
      <div className="bg-[#15161B] border border-[#292B34] rounded-[16px] p-5 flex flex-col gap-4">
        <h2 className="text-sm font-bold text-[#F5F5F7] flex items-center gap-2">
          <User className="w-4 h-4 text-[#E5484D]" />
          <span>Account Information</span>
        </h2>

        <div className="flex flex-col gap-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-[10px] bg-[#1B1D24]">
            <span className="text-[#858995]">Username</span>
            <span className="font-semibold text-white">@{profile?.username}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-[10px] bg-[#1B1D24]">
            <span className="text-[#858995]">Email</span>
            <span className="font-semibold text-white">{user?.email}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-[10px] bg-[#1B1D24]">
            <span className="text-[#858995]">Experience Level</span>
            <span className="font-semibold text-[#E5484D] uppercase tracking-wider text-[10px]">
              {profile?.experience_level || 'beginner'}
            </span>
          </div>
        </div>
      </div>

      {/* Privacy & Learning Requests Section */}
      <div className="bg-[#15161B] border border-[#292B34] rounded-[16px] p-5 flex flex-col gap-4">
        <h2 className="text-sm font-bold text-[#F5F5F7] flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#E5484D]" />
          <span>Privacy & Peer Learning Preferences</span>
        </h2>

        <div className="flex flex-col gap-3">
          <label className="flex items-center justify-between p-3 rounded-[10px] bg-[#1B1D24] cursor-pointer">
            <div className="flex flex-col pr-4">
              <span className="text-xs font-semibold text-[#F5F5F7]">
                Allow Direct Messages
              </span>
              <span className="text-[11px] text-[#858995] mt-0.5">
                Let learners reach out to coordinate skill practice sessions.
              </span>
            </div>
            <input
              type="checkbox"
              checked={allowDirectMessages}
              onChange={(e) => setAllowDirectMessages(e.target.checked)}
              className="accent-[#E5484D] w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-[10px] bg-[#1B1D24] cursor-pointer">
            <div className="flex flex-col pr-4">
              <span className="text-xs font-semibold text-[#F5F5F7]">
                Display &ldquo;Mentor / Learner&rdquo; Badge
              </span>
              <span className="text-[11px] text-[#858995] mt-0.5">
                Show whether you can teach or want to learn skills on your profile card.
              </span>
            </div>
            <input
              type="checkbox"
              checked={showLearningBadge}
              onChange={(e) => setShowLearningBadge(e.target.checked)}
              className="accent-[#E5484D] w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-[10px] bg-[#1B1D24] cursor-pointer">
            <div className="flex flex-col pr-4">
              <span className="text-xs font-semibold text-[#F5F5F7] flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-[#E5484D]" />
                <span>Learning Request Email Notifications</span>
              </span>
              <span className="text-[11px] text-[#858995] mt-0.5">
                Receive email alerts when learners request materials from your tutorial posts.
              </span>
            </div>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="accent-[#E5484D] w-4 h-4 rounded cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Community Guidelines & Safety */}
      <div className="bg-[#15161B] border border-[#292B34] rounded-[16px] p-5 flex flex-col gap-3 text-xs leading-relaxed text-[#B0B3BD]">
        <h2 className="text-sm font-bold text-[#F5F5F7] flex items-center gap-2">
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
      <div className="bg-[#15161B] border border-[#FF6269]/30 rounded-[16px] p-5 flex flex-col gap-4">
        <h2 className="text-sm font-bold text-[#FF6269] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Danger Zone</span>
        </h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-[10px] bg-[#1B1D24]">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[#F5F5F7]">Sign Out</span>
            <span className="text-[11px] text-[#858995]">
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

          <p className="text-xs text-[#858995]">
            Type <strong className="text-white">DELETE</strong> below to confirm account removal:
          </p>

          <input
            type="text"
            value={deleteConfirmationText}
            onChange={(e) => setDeleteConfirmationText(e.target.value)}
            placeholder="Type DELETE"
            className="w-full bg-[#15161B] text-[#F5F5F7] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF6269] focus:outline-none"
          />

          {deleteError && <span className="text-xs text-[#FF6269]">{deleteError}</span>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#292B34]/60">
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
