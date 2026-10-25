import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Inbox,
  Send,
  XCircle,
  FileText,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Upload,
  Link,
  Check,
} from 'lucide-react';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { Dialog } from '../components/common/Dialog';
import { EmptyState } from '../components/common/EmptyState';
import { formatTimeAgo, triggerLearningCelebration } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { LearningRequest } from '../types/database';

export const LearnPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [requests, setRequests] = useState<LearningRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fulfillment dialog state
  const [fulfillingRequest, setFulfillingRequest] = useState<LearningRequest | null>(null);
  const [resourceType, setResourceType] = useState<'link' | 'file' | 'note'>('link');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceNote, setResourceNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const isReceived = activeTab === 'received';
      const filterCol = isReceived ? 'teacher_id' : 'learner_id';

      const { data, error } = await supabase
        .from('learning_requests')
        .select('*, learner:learner_id(*), teacher:teacher_id(*), skill:skill_id(*), post:post_id(*)')
        .eq(filterCol, user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRequests(data as LearningRequest[]);
      }
    } catch (err) {
      console.error('Error fetching learning requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleUpdateStatus = async (
    requestId: string,
    status: 'accepted' | 'declined' | 'completed',
    learnerId: string
  ) => {
    try {
      await supabase
        .from('learning_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId);

      // Trigger notification for learner
      await supabase.from('notifications').insert({
        recipient_id: learnerId,
        actor_id: user?.id,
        type:
          status === 'accepted'
            ? 'learning_request_accepted'
            : status === 'declined'
            ? 'learning_request_declined'
            : 'learning_request_completed',
        related_entity_id: requestId,
      });

      if (status === 'accepted' || status === 'completed') {
        triggerLearningCelebration();
      }

      fetchRequests();
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !fulfillingRequest) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = 'learning_resources';

      const { data, error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadErr) {
        // Fallback: use object URL or public preview
        setResourceUrl(URL.createObjectURL(file));
      } else {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        setResourceUrl(urlData.publicUrl);
      }
      setResourceTitle(file.name);
    } catch (_) {
    } finally {
      setIsUploading(false);
    }
  };

  const handleFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillingRequest || !user) return;

    setIsSubmitting(true);
    try {
      await supabase
        .from('learning_requests')
        .update({
          status: 'completed',
          resource_name: resourceTitle || 'Attached Learning Resource',
          resource_url: resourceUrl,
          resource_note: resourceNote,
          fulfilled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', fulfillingRequest.id);

      // Notify learner
      await supabase.from('notifications').insert({
        recipient_id: fulfillingRequest.learner_id,
        actor_id: user.id,
        type: 'learning_request_completed',
        related_entity_id: fulfillingRequest.id,
      });

      triggerLearningCelebration();
      setFulfillingRequest(null);
      setResourceTitle('');
      setResourceUrl('');
      setResourceNote('');
      fetchRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startChatWith = async (targetUserId: string) => {
    if (!user) return;
    try {
      // Find or create conversation with this user
      const { data: existingConvs } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      const convIds = existingConvs?.map((c) => c.conversation_id) || [];
      if (convIds.length > 0) {
        const { data: match } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', targetUserId)
          .in('conversation_id', convIds)
          .maybeSingle();

        if (match) {
          navigate(`/messages?conv=${match.conversation_id}`);
          return;
        }
      }

      // Create new conversation
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ created_by: user.id })
        .select()
        .single();

      if (newConv) {
        await supabase.from('conversation_members').insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: targetUserId },
        ]);
        navigate(`/messages?conv=${newConv.id}`);
      }
    } catch (_) {
      navigate('/messages');
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 pb-2 border-b border-[#292B34]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-[#E5484D]/15 text-[#E5484D] flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-[#F5F5F7] tracking-tight">
            Peer Learning Hub
          </h1>
        </div>
        <p className="text-xs text-[#858995] leading-relaxed">
          Manage your skill material requests, share notes and source files with learners, and collaborate freely.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-[#15161B] rounded-[12px] border border-[#292B34] select-none">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-[10px] transition-all ${
            activeTab === 'received'
              ? 'bg-[#E5484D] text-white shadow-xs'
              : 'text-[#B0B3BD] hover:text-[#F5F5F7]'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Requests Received</span>
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-[10px] transition-all ${
            activeTab === 'sent'
              ? 'bg-[#E5484D] text-white shadow-xs'
              : 'text-[#B0B3BD] hover:text-[#F5F5F7]'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Requests Sent</span>
        </button>
      </div>

      {/* Requests List */}
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full h-32 bg-[#15161B] border border-[#292B34] rounded-[16px] animate-pulse"
              />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="w-6 h-6 text-[#858995]" />}
            title={
              activeTab === 'received'
                ? 'No incoming learning requests yet'
                : 'You have not requested any materials yet'
            }
            description={
              activeTab === 'received'
                ? 'When learners view your tutorial posts and click "Request Materials", their requests will appear here.'
                : 'Browse creators on Explore or the Feed, watch tutorials, and tap "Request Materials" to receive free practice notes.'
            }
            action={{
              label: 'Discover Creators',
              onClick: () => navigate('/explore'),
            }}
          />
        ) : (
          requests.map((req) => {
            const isReceived = activeTab === 'received';
            const otherParty = isReceived ? req.learner : req.teacher;
            const otherPartyName =
              otherParty?.display_name || otherParty?.full_name || otherParty?.username || 'Member';

            return (
              <div
                key={req.id}
                className="w-full bg-[#15161B] border border-[#292B34] rounded-[16px] p-4 flex flex-col gap-3 shadow-card hover:border-[#393C47] transition-all"
              >
                {/* Request Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={otherParty?.avatar_url}
                      name={otherPartyName}
                      size="md"
                      onClick={() =>
                        otherParty?.username && navigate(`/u/${otherParty.username}`)
                      }
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() =>
                            otherParty?.username && navigate(`/u/${otherParty.username}`)
                          }
                          className="text-sm font-semibold text-[#F5F5F7] hover:underline cursor-pointer"
                        >
                          {otherPartyName}
                        </span>
                        <span className="text-[11px] text-[#858995]">
                          @{otherParty?.username}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#858995]">
                        {formatTimeAgo(req.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-[8px] uppercase tracking-wider ${
                      req.status === 'completed'
                        ? 'bg-[#35B883]/15 text-[#35B883] border border-[#35B883]/30'
                        : req.status === 'accepted'
                        ? 'bg-[#70A7FF]/15 text-[#70A7FF] border border-[#70A7FF]/30'
                        : req.status === 'declined'
                        ? 'bg-[#FF6269]/15 text-[#FF6269] border border-[#FF6269]/30'
                        : 'bg-[#F0B44D]/15 text-[#F0B44D] border border-[#F0B44D]/30'
                    }`}
                  >
                    {req.status === 'completed' ? 'Fulfilled' : req.status}
                  </span>
                </div>

                {/* Skill tag & Message */}
                <div className="bg-[#1B1D24] p-3 rounded-[12px] border border-[#292B34]/60 text-xs">
                  <div className="flex items-center gap-1.5 text-[#E5484D] font-semibold mb-1.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Skill: {req.skill?.name || 'General Practice'}</span>
                  </div>
                  <p className="text-[#B0B3BD] leading-relaxed italic">
                    &ldquo;{req.message}&rdquo;
                  </p>
                </div>

                {/* Fulfilled Resources Box (if completed) */}
                {req.status === 'completed' && req.resource_url && (
                  <div className="flex items-center justify-between p-3 rounded-[12px] bg-[#35B883]/10 border border-[#35B883]/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#35B883] shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-white truncate">
                          {req.resource_name || 'Authorized Learning Resource'}
                        </span>
                        {req.resource_note && (
                          <span className="text-[11px] text-[#B0B3BD] truncate">
                            {req.resource_note}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={req.resource_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#35B883] hover:bg-[#35B883]/90 text-white text-xs font-semibold shrink-0 transition-colors"
                    >
                      <span>Access Material</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  </div>
                )}

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-[#292B34]/40">
                  <button
                    onClick={() => otherParty?.id && startChatWith(otherParty.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#B0B3BD] hover:text-[#F5F5F7] transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#E5484D]" />
                    <span>Message {isReceived ? 'Learner' : 'Creator'}</span>
                  </button>

                  {/* Actions for Creator receiving requests */}
                  {isReceived && req.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleUpdateStatus(req.id, 'declined', req.learner_id)
                        }
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#858995] hover:text-[#FF6269] transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>

                      <button
                        onClick={() => setFulfillingRequest(req)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#E5484D] hover:bg-[#D7373F] text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Attach Resources</span>
                      </button>
                    </div>
                  )}

                  {/* If already accepted but not yet fulfilled */}
                  {isReceived && req.status === 'accepted' && (
                    <button
                      onClick={() => setFulfillingRequest(req)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#35B883] hover:bg-[#35B883]/90 text-white text-xs font-semibold shadow-xs transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Materials</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Creator Fulfillment Modal */}
      {fulfillingRequest && (
        <Dialog
          isOpen={true}
          onClose={() => setFulfillingRequest(null)}
          title="Fulfill Learning Request"
          maxWidth="md"
        >
          <form onSubmit={handleFulfillSubmit} className="flex flex-col gap-4">
            <p className="text-xs text-[#858995] leading-relaxed">
              Attach practice notes, source files, GitHub links, Figma templates, or Google Drive resources for{' '}
              <strong className="text-white">
                @{fulfillingRequest.learner?.username}
              </strong>
              .
            </p>

            {/* Resource Type */}
            <div className="flex items-center gap-2 p-1 bg-[#1B1D24] rounded-[10px] border border-[#292B34]">
              <button
                type="button"
                onClick={() => setResourceType('link')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1 ${
                  resourceType === 'link'
                    ? 'bg-[#E5484D] text-white'
                    : 'text-[#B0B3BD] hover:text-white'
                }`}
              >
                <Link className="w-3.5 h-3.5" />
                <span>Web / Drive Link</span>
              </button>

              <button
                type="button"
                onClick={() => setResourceType('file')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1 ${
                  resourceType === 'file'
                    ? 'bg-[#E5484D] text-white'
                    : 'text-[#B0B3BD] hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#B0B3BD]">Resource Name</label>
              <input
                type="text"
                required
                value={resourceTitle}
                onChange={(e) => setResourceTitle(e.target.value)}
                placeholder="e.g., Complete UI Kit Figma File or Python Starter Code"
                className="w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
              />
            </div>

            {/* URL or Upload */}
            {resourceType === 'link' ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#B0B3BD]">Resource URL</label>
                <input
                  type="url"
                  required
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="https://github.com/... or https://figma.com/..."
                  className="w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-[#B0B3BD]">File Attachment</label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="text-xs text-[#858995] file:mr-3 file:py-1.5 file:px-3 file:rounded-[8px] file:border-0 file:text-xs file:font-semibold file:bg-[#E5484D] file:text-white hover:file:bg-[#D7373F]"
                />
                {isUploading && (
                  <span className="text-[11px] text-[#E5484D]">Uploading file...</span>
                )}
                {resourceUrl && (
                  <span className="text-[11px] text-[#35B883]">
                    File attached: {resourceTitle}
                  </span>
                )}
              </div>
            )}

            {/* Note */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#B0B3BD]">
                Guidance Note (Optional advice for learner)
              </label>
              <textarea
                value={resourceNote}
                onChange={(e) => setResourceNote(e.target.value)}
                rows={2}
                placeholder="Check out exercises 3 and 4 first..."
                className="w-full bg-[#15161B] text-[#F5F5F7] placeholder-[#858995] text-xs rounded-[10px] border border-[#292B34] p-2.5 focus:border-[#FF7479] focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#292B34]/60">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFulfillingRequest(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting || isUploading}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Send Materials to Learner
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};
