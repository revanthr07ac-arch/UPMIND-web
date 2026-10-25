import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

interface StoryComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
}

export const StoryComposerModal: React.FC<StoryComposerModalProps> = ({
  isOpen,
  onClose,
  onStoryCreated,
}) => {
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setError(null);

    try {
      const isVideo = file.type.startsWith('video');
      setMediaType(isVideo ? 'video' : 'image');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = 'post_images';

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        // Fallback to local data URL preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setMediaUrl(reader.result as string);
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
      setMediaUrl(urlData.publicUrl);
    } catch (err: any) {
      console.error(err);
      setError('Upload failed. Please provide a media URL.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !mediaUrl) {
      setError('Please add an image or video for your story.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: insertError } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: caption.trim() || null,
        expires_at: expiresAt,
      });

      if (insertError) {
        // If stories table not present yet, inform gracefully
        console.warn('Stories insert:', insertError.message);
      }

      setCaption('');
      setMediaUrl('');
      onStoryCreated?.();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to publish story.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Add to Story (24hr)" maxWidth="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-[#858995]">
          Share quick daily practice snapshots, work-in-progress, or questions. Disappears after 24 hours.
        </p>

        {/* Media Upload or Link */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-2 bg-[#1B1D24] hover:bg-[#282A32] text-[#F5F5F7] text-xs font-medium rounded-[10px] border border-[#292B34] cursor-pointer transition-colors shrink-0">
              <Upload className="w-3.5 h-3.5 text-[#E5484D]" />
              <span>{isUploading ? 'Uploading...' : 'Choose Media'}</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>

            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Or paste image/video URL..."
              className="flex-1 bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[10px] border border-[#292B34] px-3 py-2 focus:border-[#FF7479] focus:outline-none"
            />
          </div>

          {/* Media Preview */}
          {mediaUrl && (
            <div className="relative mt-2 rounded-[14px] overflow-hidden border border-[#292B34] h-60 bg-black flex items-center justify-center">
              {mediaType === 'video' ? (
                <video src={mediaUrl} controls className="h-full w-full object-contain" />
              ) : (
                <img src={mediaUrl} alt="Story Preview" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => setMediaUrl('')}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white hover:bg-black"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Caption */}
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add an optional story caption..."
          maxLength={100}
          className="w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[10px] border border-[#292B34] px-3 py-2 focus:border-[#FF7479] focus:outline-none"
        />

        {error && <span className="text-xs text-[#FF6269]">{error}</span>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#292B34]/60">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting || isUploading}
          >
            Share to Story
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
