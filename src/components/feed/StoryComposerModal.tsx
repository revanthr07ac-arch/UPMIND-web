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

const ALLOWED_STORY_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
];
const ALLOWED_STORY_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const MAX_STORY_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_STORY_IMAGE_SIZE = 15 * 1024 * 1024; // 15 MB

export const StoryComposerModal: React.FC<StoryComposerModalProps> = ({
  isOpen,
  onClose,
  onStoryCreated,
}) => {
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    setError(null);
    const isVideo =
      file.type.startsWith('video/') ||
      file.name.match(/\.(mp4|webm|mov|ogg|mkv)$/i) !== null;

    if (isVideo) {
      if (file.size > MAX_STORY_VIDEO_SIZE) {
        setError('Your selected file exceeds the upload size limit (50MB for story video).');
        return;
      }
      if (
        file.type &&
        !ALLOWED_STORY_VIDEO_TYPES.includes(file.type) &&
        !file.name.match(/\.(mp4|webm|mov|ogg)$/i)
      ) {
        setError('Unsupported file format. Please select a supported video (MP4, WebM, or MOV).');
        return;
      }
    } else {
      if (file.size > MAX_STORY_IMAGE_SIZE) {
        setError('Your selected file exceeds the upload size limit (15MB for story images).');
        return;
      }
      if (
        file.type &&
        !ALLOWED_STORY_IMAGE_TYPES.includes(file.type) &&
        !file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)
      ) {
        setError('Unsupported file format. Please select a supported image (JPG, PNG, or WebP).');
        return;
      }
    }

    // Clean up previous blob preview if exists
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setPreviewUrl(objectUrl);
    setMediaUrl('');
  };

  const handleRemoveMedia = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setMediaUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    const directUrl = mediaUrl.trim();
    if (!selectedFile && !directUrl) {
      setError('Please select an image/video file or provide a media URL for your story.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let finalMediaUrl = directUrl;

    try {
      // 1. Upload actual file to Supabase Storage if file was selected
      if (selectedFile) {
        setIsUploading(true);
        const isVideo = mediaType === 'video';
        const fileExt =
          selectedFile.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const fileName = `${user.id}/${uniqueSuffix}.${fileExt}`;

        let bucketUsed = 'stories';
        let uploadResult = await supabase.storage
          .from('stories')
          .upload(fileName, selectedFile, {
            contentType: selectedFile.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
            upsert: true,
          });

        // Fallback to post_images if stories bucket is not created
        if (uploadResult.error) {
          bucketUsed = 'post_images';
          uploadResult = await supabase.storage
            .from('post_images')
            .upload(fileName, selectedFile, {
              contentType: selectedFile.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
              upsert: true,
            });
        }

        if (uploadResult.error) {
          console.error('Story storage upload error:', uploadResult.error);
          const msg = uploadResult.error.message || '';
          if (
            msg.includes('schema is invalid') ||
            msg.includes('recursion') ||
            uploadResult.error.statusCode === '503'
          ) {
            setError(
              'Database storage schema requires update. Run migration 014 in Supabase SQL Editor, or provide a direct media URL.'
            );
          } else if (
            msg.includes('row-level security') ||
            uploadResult.error.statusCode === '403'
          ) {
            setError('You do not have permission to upload this content. Please sign in again.');
          } else if (
            msg.includes('mime type') ||
            uploadResult.error.statusCode === '415'
          ) {
            setError('Unsupported file format. Please select a supported image or video.');
          } else if (
            msg.includes('Bucket not found') ||
            uploadResult.error.statusCode === '404'
          ) {
            setError(
              'Stories storage bucket is not configured yet. Run migration 014 in Supabase SQL Editor, or paste a direct media URL.'
            );
          } else {
            setError('Unable to upload your media. Please try again.');
          }
          setIsSubmitting(false);
          setIsUploading(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from(bucketUsed)
          .getPublicUrl(uploadResult.data.path);

        finalMediaUrl = urlData.publicUrl;
        setIsUploading(false);
      }

      // 2. Save story metadata to database
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: insertError } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: finalMediaUrl,
        media_type: mediaType,
        caption: caption.trim() || null,
        expires_at: expiresAt,
      });

      if (insertError) {
        console.error('Stories database insert error:', insertError);
        if (
          insertError.code === 'PGRST205' ||
          insertError.message?.includes('schema cache') ||
          insertError.message?.includes('does not exist')
        ) {
          setError(
            'The stories table does not exist in the database. Please execute migration 014 in the Supabase SQL Editor.'
          );
        } else {
          setError(insertError.message || 'Your story could not be saved. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      // Clean up local preview object URL
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }

      setCaption('');
      setMediaUrl('');
      setSelectedFile(null);
      setPreviewUrl('');
      onStoryCreated?.();
      window.dispatchEvent(new CustomEvent('upmind:refreshStories'));
      onClose();
    } catch (err: any) {
      console.error('Story publish error:', err);
      setError(err.message || 'Failed to publish story. Please try again.');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const activeDisplayUrl = previewUrl || mediaUrl;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Add to Story (24hr)" maxWidth="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-xs text-muted">
          Share quick daily practice snapshots, work-in-progress, or questions. Disappears after 24 hours.
        </p>

        {/* Media Upload or Link */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-2 bg-surface-secondary hover:bg-surface-tertiary text-primary text-xs font-medium rounded-[10px] border border-theme cursor-pointer transition-colors shrink-0">
              <Upload className="w-3.5 h-3.5 text-[#FF304F]" />
              <span>{isUploading ? 'Uploading...' : 'Choose Media'}</span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                disabled={isUploading || isSubmitting}
                className="hidden"
              />
            </label>

            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => {
                setMediaUrl(e.target.value);
                if (e.target.value) {
                  setSelectedFile(null);
                  setPreviewUrl(e.target.value);
                }
              }}
              placeholder="Or paste image/video URL..."
              disabled={isUploading || isSubmitting}
              className="flex-1 bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme px-3 py-2 focus:border-[#FF304F] focus:outline-none"
            />
          </div>

          {/* Media Preview */}
          {activeDisplayUrl && (
            <div className="relative mt-2 rounded-[14px] overflow-hidden border border-theme h-60 bg-black flex items-center justify-center">
              {mediaType === 'video' ? (
                <video src={activeDisplayUrl} controls className="h-full w-full object-contain" />
              ) : (
                <img src={activeDisplayUrl} alt="Story Preview" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={handleRemoveMedia}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer transition-colors"
                title="Remove media"
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
          disabled={isSubmitting || isUploading}
          className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme px-3 py-2 focus:border-[#FF304F] focus:outline-none"
        />

        {error && (
          <div className="p-2.5 rounded-[8px] bg-[#FF304F]/10 border border-[#FF304F]/30 text-xs text-[#FF304F] leading-relaxed">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting || isUploading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting || isUploading}
            disabled={isSubmitting || isUploading}
          >
            Share to Story
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
