import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../common/Avatar';
import type { Profile } from '../../types/database';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onProfileUpdated?: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
}) => {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile.display_name || profile.full_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [institution, setInstitution] = useState(profile.institution || '');
  const [course, setCourse] = useState(profile.course || '');
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || '');
  const [experienceLevel, setExperienceLevel] = useState<'beginner' | 'intermediate' | 'advanced'>(
    profile.experience_level || 'beginner'
  );
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setError(null);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = 'avatars';

      const { data, error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadErr) {
        // Fallback to local base64
        const reader = new FileReader();
        reader.onloadend = () => {
          setAvatarUrl(reader.result as string);
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
      setAvatarUrl(urlData.publicUrl);
    } catch (err: any) {
      setError('Could not upload avatar. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: updateErr } = await updateProfile({
        display_name: displayName.trim(),
        full_name: displayName.trim(),
        bio: bio.trim() || null,
        location: location.trim() || null,
        institution: institution.trim() || null,
        course: course.trim() || null,
        website_url: websiteUrl.trim() || null,
        experience_level: experienceLevel,
        avatar_url: avatarUrl || null,
      });

      if (updateErr) throw updateErr;

      onProfileUpdated?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Edit Profile" maxWidth="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Avatar Upload */}
        <div className="flex items-center gap-4 p-3 bg-surface-secondary rounded-[14px] border border-theme">
          <Avatar src={avatarUrl} name={displayName || profile.username} size="xl" />
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF304F] hover:bg-[#E5203F] text-white text-xs font-semibold rounded-[8px] cursor-pointer transition-colors shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading...' : 'Change Photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
            <span className="text-[10px] text-muted">Square JPG or PNG, max 5MB</span>
          </div>
        </div>

        {/* Display Name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-secondary">Display Name</label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-surface text-primary text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
          />
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-secondary">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Tell learners about your experience, what skills you can teach or want to learn..."
            className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
          />
        </div>

        {/* Institution / College & Course */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">College / Organization</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g., Stanford University / Freelance"
              className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">Course / Specialization</label>
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="e.g., Computer Science / Design"
              className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
            />
          </div>
        </div>

        {/* Location & Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., San Francisco, CA"
              className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-secondary">Portfolio Link</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://myportfolio.com"
              className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
            />
          </div>
        </div>

        {/* Experience Level */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-secondary">Experience Level</label>
          <select
            value={experienceLevel}
            onChange={(e) =>
              setExperienceLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')
            }
            className="w-full bg-surface text-primary text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
          >
            <option value="beginner">Beginner (Starting learning journey)</option>
            <option value="intermediate">Intermediate (Building projects)</option>
            <option value="advanced">Advanced (Mentoring & teaching peers)</option>
          </select>
        </div>

        {error && <span className="text-xs text-[#FF6269]">{error}</span>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
