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
import { getOrCreateDirectConversation } from '../lib/conversations';
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
      const { conversationId, error } = await getOrCreateDirectConversation(user.id, targetUserId);
      if (conversationId) {
        navigate(`/messages?conv=${conversationId}`);
      } else {
        console.error('Failed to open conversation:', error);
        navigate('/messages');
      }
    } catch (err) {
      console.error('startChatWith error:', err);
      navigate('/messages');
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1.5 pb-2 border-b border-theme">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-[#FF304F]/15 text-[#FF304F] flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-primary tracking-tight">
            Peer Learning Hub
          </h1>
        </div>
        <p className="text-xs text-secondary leading-relaxed">
          Manage your skill material requests, share notes and source files with learners, and collaborate freely.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-surface-secondary rounded-[12px] border border-theme select-none">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-[10px] transition-all ${
            activeTab === 'received'
              ? 'bg-[#FF304F] text-white shadow-xs'
              : 'text-secondary hover:text-primary'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Requests Received</span>
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-[10px] transition-all ${
            activeTab === 'sent'
              ? 'bg-[#FF304F] text-white shadow-xs'
              : 'text-secondary hover:text-primary'
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
                className="w-full h-32 bg-surface border border-theme rounded-[16px] animate-pulse"
              />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="w-6 h-6 text-muted" />}
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
                className="w-full bg-surface border border-theme rounded-[16px] p-4 flex flex-col gap-3 shadow-card hover:border-theme-strong transition-all"
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
                          className="text-sm font-semibold text-primary hover:underline cursor-pointer"
                        >
                          {otherPartyName}
                        </span>
                        <span className="text-[11px] text-muted">
                          @{otherParty?.username}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted">
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
                <div className="bg-surface-secondary p-3 rounded-[12px] border border-theme text-xs">
                  <div className="flex items-center gap-1.5 text-[#FF304F] font-semibold mb-1.5">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Skill: {req.skill?.name || 'General Practice'}</span>
                  </div>
                  <p className="text-secondary leading-relaxed italic">
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
                          <span className="text-[11px] text-white/80 truncate">
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
                <div className="flex items-center justify-between pt-2 border-t border-theme">
                  <button
                    onClick={() => otherParty?.id && startChatWith(otherParty.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#FF304F]" />
                    <span>Message {isReceived ? 'Learner' : 'Creator'}</span>
                  </button>

                  {/* Actions for Creator receiving requests */}
                  {isReceived && req.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleUpdateStatus(req.id, 'declined', req.learner_id)
                        }
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-muted hover:text-[#FF6269] transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>

                      <button
                        onClick={() => setFulfillingRequest(req)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#FF304F] hover:bg-[#E5203F] text-white text-xs font-semibold shadow-xs transition-colors"
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
            <p className="text-xs text-muted leading-relaxed">
              Attach practice notes, source files, GitHub links, Figma templates, or Google Drive resources for{' '}
              <strong className="text-primary">
                @{fulfillingRequest.learner?.username}
              </strong>
              .
            </p>

            {/* Resource Type */}
            <div className="flex items-center gap-2 p-1 bg-surface-secondary rounded-[10px] border border-theme">
              <button
                type="button"
                onClick={() => setResourceType('link')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-[8px] transition-colors flex items-center justify-center gap-1 ${
                  resourceType === 'link'
                    ? 'bg-[#FF304F] text-white'
                    : 'text-secondary hover:text-primary'
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
                    ? 'bg-[#FF304F] text-white'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-secondary">Resource Name</label>
              <input
                type="text"
                required
                value={resourceTitle}
                onChange={(e) => setResourceTitle(e.target.value)}
                placeholder="e.g., Complete UI Kit Figma File or Python Starter Code"
                className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
              />
            </div>

            {/* URL or Upload */}
            {resourceType === 'link' ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-secondary">Resource URL</label>
                <input
                  type="url"
                  required
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="https://github.com/... or https://figma.com/..."
                  className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-secondary">File Attachment</label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="text-xs text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-[8px] file:border-0 file:text-xs file:font-semibold file:bg-[#FF304F] file:text-white hover:file:bg-[#E5203F]"
                />
                {isUploading && (
                  <span className="text-[11px] text-[#FF304F]">Uploading file...</span>
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
              <label className="text-xs font-medium text-secondary">
                Guidance Note (Optional advice for learner)
              </label>
              <textarea
                value={resourceNote}
                onChange={(e) => setResourceNote(e.target.value)}
                rows={2}
                placeholder="Check out exercises 3 and 4 first..."
                className="w-full bg-surface text-primary placeholder-[#9297A2] text-xs rounded-[10px] border border-theme p-2.5 focus:border-[#FF304F] focus:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme">
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
