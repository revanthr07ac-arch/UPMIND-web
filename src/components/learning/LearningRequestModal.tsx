import React, { useState } from 'react';
import { GraduationCap, Sparkles, Send, CheckCircle2 } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../common/Avatar';
import { triggerLearningCelebration } from '../../lib/utils';
import type { Post } from '../../types/database';

interface LearningRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  onSuccess?: () => void;
}

export const LearningRequestModal: React.FC<LearningRequestModalProps> = ({
  isOpen,
  onClose,
  post,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [message, setMessage] = useState(
    'Hi! I loved your tutorial post and would love to access your practice notes and learning materials to study this skill.'
  );
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [skillsList, setSkillsList] = useState<Array<{ id: string; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
      setError(null);
      return;
    }

    async function loadSkills() {
      try {
        const { data } = await supabase.from('skills').select('id, name').limit(20);
        if (data && data.length > 0) {
          setSkillsList(data);
          // Match skill from post tags if possible
          if (post?.skill_tags && post.skill_tags.length > 0) {
            const rawTag = post.skill_tags[0].replace('#', '').toLowerCase();
            const match = data.find((s) => s.name.toLowerCase().includes(rawTag));
            if (match) {
              setSelectedSkillId(match.id);
            } else {
              setSelectedSkillId(data[0].id);
            }
          } else {
            setSelectedSkillId(data[0].id);
          }
        }
      } catch (_) {}
    }

    loadSkills();
  }, [isOpen, post]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post) return;

    if (user.id === post.author_id) {
      setError('You cannot request learning materials from your own post.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Insert into learning_requests table
      const { data: requestRecord, error: insertError } = await supabase
        .from('learning_requests')
        .insert({
          learner_id: user.id,
          teacher_id: post.author_id,
          skill_id: selectedSkillId,
          post_id: post.id,
          message: message.trim(),
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        // If duplicate pending exists or constraint
        if (insertError.message.includes('unique') || insertError.code === '23505') {
          setError('You already have a pending learning request with this creator for this skill.');
          setIsSubmitting(false);
          return;
        }
        throw insertError;
      }

      // 2. Trigger notification for the creator
      await supabase.from('notifications').insert({
        recipient_id: post.author_id,
        actor_id: user.id,
        type: 'learning_request_new',
        related_entity_id: requestRecord.id,
      });

      triggerLearningCelebration();
      setIsSuccess(true);
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send learning request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!post) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Request Free Learning Materials"
      maxWidth="md"
    >
      {isSuccess ? (
        <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
          <div className="w-14 h-14 rounded-full bg-[#35B883]/15 text-[#35B883] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-[#F5F5F7]">
            Request Sent to @{post.author?.username}!
          </h3>
          <p className="text-xs text-[#B0B3BD] max-w-sm leading-relaxed">
            The creator will review your request. Once approved, the learning notes, files, or links will appear in your{' '}
            <span className="text-[#E5484D] font-semibold">Learning Hub</span>.
          </p>
          <div className="pt-2">
            <Button variant="primary" size="md" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Creator & Post Summary Header */}
          <div className="flex items-center gap-3 p-3 rounded-[12px] bg-[#1B1D24] border border-[#292B34]">
            <Avatar
              src={post.author?.avatar_url}
              name={post.author?.full_name || post.author?.username}
              size="md"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[#F5F5F7]">
                Teacher: {post.author?.display_name || post.author?.full_name || post.author?.username}
              </span>
              <span className="text-[11px] text-[#858995] truncate">
                Post: &ldquo;{post.caption}&rdquo;
              </span>
            </div>
          </div>

          {/* Differentiator Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-[12px] bg-[#E5484D]/10 border border-[#E5484D]/30">
            <Sparkles className="w-4 h-4 text-[#E5484D] shrink-0 mt-0.5" />
            <div className="text-xs text-[#B0B3BD] leading-relaxed">
              <strong className="text-white">100% Free Peer Learning:</strong> Creators share source code, design templates, practice notes, and tutorials directly with learners.
            </div>
          </div>

          {/* Skill Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#B0B3BD] flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-[#E5484D]" />
              Skill Domain
            </label>
            <select
              value={selectedSkillId}
              onChange={(e) => setSelectedSkillId(e.target.value)}
              className="w-full bg-[#15161B] text-[#F5F5F7] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
            >
              {skillsList.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </div>

          {/* Message Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#B0B3BD]">
              Message to Creator (Optional note)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Explain what you want to practice or any specific questions..."
              className="w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
            />
          </div>

          {error && <span className="text-xs text-[#FF6269]">{error}</span>}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#292B34]/60">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Send Request
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
};
