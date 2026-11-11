import React, { useState, useEffect } from 'react';
import { Tag, X, Upload, RotateCcw } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { extractUserStoragePath } from '../../lib/postActions';
import type { Post } from '../../types/database';

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  onPostUpdated?: (updatedPost: Post) => void;
}

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/ogg',
  'video/x-matroska',
];
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15 MB

export const EditPostModal: React.FC<EditPostModalProps> = ({
  isOpen,
  onClose,
  post,
  onPostUpdated,
}) => {
  const { user } = useAuth();

  const [caption, setCaption] = useState('');
  const [educationalDescription, setEducationalDescription] = useState('');
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Media state
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementPreview, setReplacementPreview] = useState<string | null>(null);
  const [replacementUrl, setReplacementUrl] = useState<string>('');
  const [isReplacingMedia, setIsReplacingMedia] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state when post changes
  useEffect(() => {
    if (post && isOpen) {
      setCaption(post.caption || '');
      setEducationalDescription(post.educational_description || '');
      setSkillTags(post.skill_tags || []);
      setOriginalImageUrl(post.image_url || null);
      setOriginalVideoUrl(post.video_url || null);
      setReplacementFile(null);
      setReplacementPreview(null);
      setReplacementUrl('');
      setIsReplacingMedia(false);
      setError(null);
      setTagInput('');
    }
  }, [post, isOpen]);

  if (!post) return null;

  const popularSkills = [
    'UI/UX Design',
    'Flutter & Dart',
    'Python Programming',
    'Graphic Design',
    'Video Editing',
    'AI & Prompting',
  ];

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const formatted = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    if (!skillTags.includes(formatted)) {
      setSkillTags([...skillTags, formatted]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSkillTags(skillTags.filter((t) => t !== tagToRemove));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const isVideo =
      file.type.startsWith('video/') ||
      file.name.match(/\.(mp4|webm|mov|ogg|mkv)$/i) !== null;

    if (isVideo) {
      if (file.size > MAX_VIDEO_SIZE) {
        setError('Your selected video exceeds the 100MB limit.');
        return;
      }
      if (file.type && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
        setError('Unsupported video format. Please upload MP4, WebM, or MOV.');
        return;
      }
    } else {
      if (file.size > MAX_IMAGE_SIZE) {
        setError('Your selected image exceeds the 15MB limit.');
        return;
      }
      if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError('Unsupported image format. Please upload JPG, PNG, or WebP.');
        return;
      }
    }

    setReplacementFile(file);
    setReplacementUrl('');
    // Create local object URL for instant preview
    const preview = URL.createObjectURL(file);
    setReplacementPreview(preview);
  };

  const handleRevertMedia = () => {
    if (replacementPreview) {
      URL.revokeObjectURL(replacementPreview);
    }
    setReplacementFile(null);
    setReplacementPreview(null);
    setReplacementUrl('');
    setIsReplacingMedia(false);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to edit this post.');
      return;
    }

    // Strict ownership verification
    if (user.id !== post.author_id) {
      setError('You are not authorized to edit this post.');
      return;
    }

    const trimmedCaption = caption.trim();
    if (!trimmedCaption) {
      setError('Caption cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let newlyUploadedPath: string | null = null;
    let newlyUploadedBucket: string | null = null;
    let finalImageUrl = originalImageUrl;
    let finalVideoUrl = originalVideoUrl;

    try {
      // 1. If replacement file selected, upload it first
      if (replacementFile) {
        setIsUploading(true);
        const isVideo =
          replacementFile.type.startsWith('video/') ||
          replacementFile.name.match(/\.(mp4|webm|mov|ogg|mkv)$/i) !== null;

        const fileExt =
          replacementFile.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const fileName = `${user.id}/${uniqueSuffix}.${fileExt}`;
        const targetBucket = isVideo ? 'reels_videos' : 'post_images';

        let uploadResult = await supabase.storage.from(targetBucket).upload(fileName, replacementFile, {
          contentType: replacementFile.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
          upsert: true,
        });

        // Fallback to post_images if reels_videos bucket not found
        if (uploadResult.error && isVideo) {
          uploadResult = await supabase.storage.from('post_images').upload(fileName, replacementFile, {
            contentType: replacementFile.type || 'video/mp4',
            upsert: true,
          });
          newlyUploadedBucket = 'post_images';
        } else {
          newlyUploadedBucket = targetBucket;
        }

        if (uploadResult.error) {
          throw new Error(`Media upload failed: ${uploadResult.error.message}`);
        }

        newlyUploadedPath = uploadResult.data.path;

        const { data: urlData } = supabase.storage
          .from(newlyUploadedBucket)
          .getPublicUrl(uploadResult.data.path);

        if (isVideo) {
          finalVideoUrl = urlData.publicUrl;
          finalImageUrl = null;
        } else {
          finalImageUrl = urlData.publicUrl;
          finalVideoUrl = null;
        }
        setIsUploading(false);
      } else if (replacementUrl.trim()) {
        const url = replacementUrl.trim();
        const isVideoUrl = url.match(/\.(mp4|webm|mov)(\?.*)?$/i) !== null;
        if (isVideoUrl) {
          finalVideoUrl = url;
          finalImageUrl = null;
        } else {
          finalImageUrl = url;
          finalVideoUrl = null;
        }
      }

      // 2. Update post record in database
      const { data, error: updateError } = await supabase
        .from('posts')
        .update({
          caption: trimmedCaption,
          educational_description: educationalDescription.trim() || null,
          skill_tags: skillTags,
          image_url: finalImageUrl,
          video_url: finalVideoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
        .eq('author_id', user.id)
        .select('*, author:author_id(*)')
        .single();

      if (updateError) {
        // Safe rollback: clean up the newly uploaded file if database update fails
        if (newlyUploadedBucket && newlyUploadedPath) {
          await supabase.storage.from(newlyUploadedBucket).remove([newlyUploadedPath]);
        }
        throw updateError;
      }

      // 3. Media cleanup: If new media saved successfully and original media was user-owned storage, clean it up
      if (replacementFile || replacementUrl.trim()) {
        const oldUrls = [originalImageUrl, originalVideoUrl].filter(Boolean) as string[];
        for (const oldUrl of oldUrls) {
          const oldStorage = extractUserStoragePath(oldUrl, user.id);
          if (oldStorage) {
            supabase.storage.from(oldStorage.bucket).remove([oldStorage.path]).catch(() => {});
          }
        }
      }

      // 4. Notify app listeners & close
      onPostUpdated?.(data as Post);

      window.dispatchEvent(
        new CustomEvent('upmind:postUpdated', {
          detail: { post: data },
        })
      );
      window.dispatchEvent(new CustomEvent('upmind:refreshFeed'));

      onClose();
    } catch (err: any) {
      console.error('Edit post error:', err);
      setError(err.message || 'Failed to update post. Please try again.');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const isVideoPost = !!(originalVideoUrl || post.post_type === 'reel' || post.post_type === 'video');

  return (
    <Dialog isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose} title="Edit Post" maxWidth="lg">
      <form onSubmit={handleSave} className="flex flex-col gap-4 text-xs select-none">
        {error && (
          <div className="p-3 rounded-[10px] bg-[#FF6269]/10 border border-[#FF6269]/30 text-[#FF6269] text-xs">
            {error}
          </div>
        )}

        {/* Media Preview & Replacement Section */}
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-primary">Media</label>

          <div className="relative rounded-[14px] overflow-hidden border border-theme bg-surface-secondary">
            {/* Show replacement preview if present, otherwise show existing media */}
            {replacementPreview ? (
              <div className="relative w-full max-h-64 flex items-center justify-center bg-black">
                {replacementFile?.type.startsWith('video/') ? (
                  <video src={replacementPreview} controls className="max-h-64 w-auto object-contain" />
                ) : (
                  <img src={replacementPreview} alt="Replacement preview" className="max-h-64 w-auto object-contain" />
                )}
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRevertMedia}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-black/70 hover:bg-black text-white text-[11px] font-medium transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Revert
                  </button>
                </div>
              </div>
            ) : originalImageUrl || originalVideoUrl ? (
              <div className="relative w-full max-h-64 flex items-center justify-center bg-black">
                {isVideoPost ? (
                  <video
                    src={originalVideoUrl || originalImageUrl || ''}
                    controls
                    className="max-h-64 w-auto object-contain"
                  />
                ) : (
                  <img
                    src={originalImageUrl!}
                    alt="Current post media"
                    className="max-h-64 w-auto object-contain"
                  />
                )}

                <div className="absolute top-2 right-2">
                  {!isReplacingMedia ? (
                    <button
                      type="button"
                      onClick={() => setIsReplacingMedia(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-black/75 hover:bg-black text-white text-xs font-medium transition-colors shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Replace Media
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsReplacingMedia(false)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-black/75 hover:bg-black text-white text-xs font-medium transition-colors"
                    >
                      Cancel Replace
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-muted">
                No media attached to this post.
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsReplacingMedia(true)}
                  >
                    Add Media
                  </Button>
                </div>
              </div>
            )}

            {/* Replacement input panel */}
            {isReplacingMedia && !replacementPreview && (
              <div className="p-3 border-t border-theme flex flex-col gap-2.5 bg-surface">
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-[#FF304F]/50 rounded-[10px] hover:bg-[#FF304F]/5 cursor-pointer text-xs font-medium text-primary">
                    <Upload className="w-4 h-4 text-[#FF304F]" />
                    <span>Upload New Photo or Video</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">Or enter URL:</span>
                  <input
                    type="url"
                    value={replacementUrl}
                    onChange={(e) => setReplacementUrl(e.target.value)}
                    placeholder="https://example.com/media.jpg"
                    className="flex-1 bg-surface-secondary text-xs text-primary rounded-[8px] border border-theme px-2.5 py-1.5 focus:outline-none focus:border-[#FF304F]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Caption */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-primary">Caption *</label>
            <span className="text-[10px] text-muted">{caption.length}/2200</span>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={2200}
            required
            placeholder="Write a caption..."
            className="w-full bg-surface-secondary text-primary placeholder-[#9297A2] rounded-[12px] border border-theme p-3 focus:outline-none focus:border-[#FF304F] resize-none leading-relaxed"
          />
        </div>

        {/* Educational Description (Tutorial / Learning) */}
        <div className="flex flex-col gap-1.5">
          <label className="font-semibold text-primary">
            Educational Description / Tutorial Steps (Optional)
          </label>
          <textarea
            value={educationalDescription}
            onChange={(e) => setEducationalDescription(e.target.value)}
            rows={3}
            maxLength={3000}
            placeholder="Share step-by-step instructions, learning resources, or tips..."
            className="w-full bg-surface-secondary text-primary placeholder-[#9297A2] rounded-[12px] border border-theme p-3 focus:outline-none focus:border-[#FF304F] resize-none leading-relaxed"
          />
        </div>

        {/* Skill Tags */}
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-primary flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#FF304F]" />
            Skill Tags
          </label>

          {/* Current tags */}
          <div className="flex flex-wrap gap-1.5 min-h-[30px] p-2 bg-surface-secondary rounded-[10px] border border-theme">
            {skillTags.length === 0 ? (
              <span className="text-[11px] text-muted">No skill tags added.</span>
            ) : (
              skillTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#FF304F]/10 text-[#FF304F] font-semibold text-[11px]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-primary transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>

          {/* Tag input and popular tags */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(tagInput);
                }
              }}
              placeholder="Add skill tag (e.g. Figma, Python)..."
              className="flex-1 bg-surface-secondary text-primary rounded-[8px] border border-theme px-3 py-1.5 focus:outline-none focus:border-[#FF304F]"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddTag(tagInput)}
            >
              Add
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-muted">Popular:</span>
            {popularSkills.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => handleAddTag(skill)}
                className="px-2 py-0.5 rounded-[6px] bg-surface-secondary hover:bg-surface-tertiary text-[10px] text-secondary border border-theme transition-colors cursor-pointer"
              >
                +{skill}
              </button>
            ))}
          </div>
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-theme mt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting || isUploading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting || isUploading}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
