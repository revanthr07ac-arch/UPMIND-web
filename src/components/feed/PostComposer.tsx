import React, { useState, useEffect } from 'react';
import { Image, Video, BookOpen, Tag, X, Upload } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../common/Avatar';

interface PostComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
  defaultPostType?: 'image' | 'tutorial' | 'reel' | 'text';
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

export const PostComposer: React.FC<PostComposerProps> = ({
  isOpen,
  onClose,
  onPostCreated,
  defaultPostType = 'image',
}) => {
  const { user, profile } = useAuth();
  const [caption, setCaption] = useState('');
  const [postType, setPostType] = useState<'image' | 'tutorial' | 'reel' | 'text'>(defaultPostType);
  const [mediaUrl, setMediaUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [educationalDescription, setEducationalDescription] = useState('');
  const [skillTags, setSkillTags] = useState<string[]>(['#PeerLearning']);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (defaultPostType) {
        setPostType(defaultPostType);
      }
      setError(null);
    }
  }, [isOpen, defaultPostType]);

  const popularSkills = [
    'UI/UX Design',
    'Flutter & Dart',
    'Python Programming',
    'Graphic Design',
    'Video Editing',
    'AI & Prompting',
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setError(null);
    const isVideo =
      file.type.startsWith('video/') ||
      file.name.match(/\.(mp4|webm|mov|ogg|mkv)$/i) !== null;

    if (isVideo) {
      if (file.size > MAX_VIDEO_SIZE) {
        setError('Video file is too large. Maximum permitted size is 100MB.');
        return;
      }
      if (
        file.type &&
        !ALLOWED_VIDEO_TYPES.includes(file.type) &&
        !file.name.match(/\.(mp4|webm|mov|ogg|mkv)$/i)
      ) {
        setError('Unsupported video format. Please upload MP4, WebM, or MOV video.');
        return;
      }
    } else {
      if (file.size > MAX_IMAGE_SIZE) {
        setError('Image file is too large. Maximum permitted size is 15MB.');
        return;
      }
      if (
        file.type &&
        !ALLOWED_IMAGE_TYPES.includes(file.type) &&
        !file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)
      ) {
        setError('Unsupported image format. Please upload JPG, PNG, or WebP.');
        return;
      }
    }

    setIsUploading(true);

    try {
      const fileExt =
        file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const primaryBucket = isVideo ? 'reels_videos' : 'post_images';
      let uploadResult = await supabase.storage
        .from(primaryBucket)
        .upload(fileName, file, { upsert: true });

      // If reels_videos fails (e.g. permissions or bucket missing), fallback to post_images
      if (uploadResult.error && isVideo) {
        uploadResult = await supabase.storage
          .from('post_images')
          .upload(fileName, file, { upsert: true });
      }

      if (uploadResult.error) {
        setError(
          `Upload failed: ${uploadResult.error.message || 'Storage error'}. Please try again or provide a direct video URL.`
        );
        setIsUploading(false);
        return;
      }

      const bucketUsed =
        isVideo && !uploadResult.error ? primaryBucket : 'post_images';
      const { data: urlData } = supabase.storage
        .from(bucketUsed)
        .getPublicUrl(uploadResult.data.path);

      if (isVideo) {
        setVideoUrl(urlData.publicUrl);
        setPostType('reel');
      } else {
        setMediaUrl(urlData.publicUrl);
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setError(err.message || 'Could not upload media. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddTag = (tag: string) => {
    const formatted = tag.startsWith('#') ? tag : `#${tag}`;
    if (!skillTags.includes(formatted)) {
      setSkillTags([...skillTags, formatted]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSkillTags(skillTags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!caption.trim()) {
      setError('Please add a caption to your post.');
      return;
    }

    const isReel = postType === 'reel';
    const video = videoUrl.trim();

    if (isReel && !video) {
      setError('Please upload a video or provide a valid video link to publish a reel.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const tags =
        isReel && !skillTags.some((t) => t.toLowerCase().includes('reel'))
          ? [...skillTags, '#Reel']
          : skillTags;

      const basePost = {
        author_id: user.id,
        caption: caption.trim(),
        educational_description: educationalDescription.trim() || null,
        skill_tags: tags,
        visibility: 'public' as const,
        likes_count: 0,
        comments_count: 0,
      };

      // Attempt 1: Full Migration 012 schema
      let insertResult = await supabase.from('posts').insert({
        ...basePost,
        image_url: mediaUrl.trim() || (isReel ? video : null),
        video_url: isReel ? video : null,
        post_type: isReel ? 'reel' : postType,
        is_reel: isReel,
      });

      // Attempt 2: If video_url or is_reel columns do not exist in DB (code 42703)
      if (
        insertResult.error &&
        (insertResult.error.code === '42703' ||
          insertResult.error.message?.includes('does not exist'))
      ) {
        insertResult = await supabase.from('posts').insert({
          ...basePost,
          image_url: isReel ? video : mediaUrl.trim() || null,
          post_type: isReel ? 'reel' : postType,
        });
      }

      // Attempt 3: If check constraint fails on post_type = 'reel' (code 23514)
      if (
        insertResult.error &&
        (insertResult.error.code === '23514' ||
          insertResult.error.message?.includes('check constraint'))
      ) {
        insertResult = await supabase.from('posts').insert({
          ...basePost,
          image_url: isReel ? video : mediaUrl.trim() || null,
          post_type: 'tutorial',
        });
      }

      if (insertResult.error) {
        throw insertResult.error;
      }

      // Reset form
      setCaption('');
      setMediaUrl('');
      setVideoUrl('');
      setEducationalDescription('');
      setSkillTags(['#PeerLearning']);
      onPostCreated?.();
      window.dispatchEvent(new CustomEvent('upmind:refreshFeed'));
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to publish post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create Skill Post" maxWidth="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Author Header */}
        <div className="flex items-center gap-3">
          <Avatar
            src={profile?.avatar_url}
            name={profile?.full_name || profile?.username}
            size="md"
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#F5F5F7]">
              {profile?.display_name || profile?.full_name || profile?.username}
            </span>
            <span className="text-xs text-[#858995]">Share skills & peer learning</span>
          </div>
        </div>

        {/* Post Type Selector */}
        <div className="flex items-center gap-2 p-1 bg-[#1B1D24] rounded-[12px] border border-[#292B34]">
          <button
            type="button"
            onClick={() => setPostType('image')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-[8px] transition-colors ${
              postType === 'image'
                ? 'bg-[#E5484D] text-white shadow-xs'
                : 'text-[#B0B3BD] hover:text-white'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            <span>Showcase</span>
          </button>

          <button
            type="button"
            onClick={() => setPostType('reel')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-[8px] transition-colors ${
              postType === 'reel'
                ? 'bg-[#E5484D] text-white shadow-xs'
                : 'text-[#B0B3BD] hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Short Reel</span>
          </button>

          <button
            type="button"
            onClick={() => setPostType('tutorial')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-[8px] transition-colors ${
              postType === 'tutorial'
                ? 'bg-[#E5484D] text-white shadow-xs'
                : 'text-[#B0B3BD] hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Tutorial</span>
          </button>
        </div>

        {/* Caption Input */}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="What skill are you sharing today? (e.g., Clean Architecture in Flutter, Figma Auto-Layout tips...)"
          rows={3}
          required
          className="w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-sm rounded-[12px] border border-[#292B34] p-3.5 focus:border-[#FF7479] focus:outline-none focus:ring-1 focus:ring-[#FF7479] transition-all"
        />

        {/* Tutorial Breakdown Section */}
        {postType === 'tutorial' && (
          <div className="flex flex-col gap-1.5 bg-[#1B1D24]/50 border border-[#292B34] rounded-[12px] p-3">
            <span className="text-xs font-semibold text-[#E5484D] flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              Step-by-step breakdown (Lesson details)
            </span>
            <textarea
              value={educationalDescription}
              onChange={(e) => setEducationalDescription(e.target.value)}
              placeholder="Outline the steps or concepts: Step 1: ..., Step 2: ..., Concepts learned..."
              rows={3}
              className="w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[8px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
            />
          </div>
        )}

        {/* Media Upload or Link */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[#B0B3BD] flex items-center justify-between">
            <span>{postType === 'reel' ? 'Video File or URL (MP4, WebM, MOV)' : 'Image File or URL'}</span>
            <span className="text-[10px] text-[#858995]">{postType === 'reel' ? 'Max 100MB' : 'Max 15MB'}</span>
          </label>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-2 bg-[#1B1D24] hover:bg-[#282A32] text-[#F5F5F7] text-xs font-medium rounded-[10px] border border-[#292B34] cursor-pointer transition-colors shrink-0">
              <Upload className="w-3.5 h-3.5 text-[#E5484D]" />
              <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
              <input
                type="file"
                accept={postType === 'reel' ? 'video/mp4,video/webm,video/quicktime,video/*' : 'image/jpeg,image/png,image/webp,image/*'}
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>

            <input
              type="url"
              value={postType === 'reel' ? videoUrl : mediaUrl}
              onChange={(e) =>
                postType === 'reel' ? setVideoUrl(e.target.value) : setMediaUrl(e.target.value)
              }
              placeholder="Or paste public media URL..."
              className="flex-1 bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[10px] border border-[#292B34] px-3 py-2 focus:border-[#FF7479] focus:outline-none"
            />
          </div>

          {/* Media Preview */}
          {(mediaUrl || videoUrl) && (
            <div className="relative mt-2 rounded-[12px] overflow-hidden border border-[#292B34] max-h-48 bg-black flex items-center justify-center">
              {postType === 'reel' || videoUrl ? (
                <video src={videoUrl} controls className="max-h-48 w-full object-contain" />
              ) : (
                <img src={mediaUrl} alt="Preview" className="max-h-48 w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => {
                  setMediaUrl('');
                  setVideoUrl('');
                }}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white hover:bg-black transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Skill Tags */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[#B0B3BD] flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-[#E5484D]" />
            <span>Skill Tags (enables peer learners to find and request materials)</span>
          </label>

          {/* Selected tags */}
          <div className="flex flex-wrap gap-1.5">
            {skillTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-[#E5484D]/10 text-[#E5484D] border border-[#E5484D]/30 text-xs font-medium"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* Popular skill pills to click */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {popularSkills.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleAddTag(s)}
                className="text-[11px] px-2 py-0.5 rounded-[6px] bg-[#1B1D24] text-[#B0B3BD] hover:text-[#F5F5F7] hover:bg-[#282A32] border border-[#292B34] transition-colors"
              >
                +{s}
              </button>
            ))}
          </div>
        </div>

        {error && <span className="text-xs text-[#FF6269] mt-1">{error}</span>}

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#292B34]/60">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting || isUploading}
          >
            Publish Post
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
