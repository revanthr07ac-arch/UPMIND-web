import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { Button } from '../common/Button';
import type { Post } from '../../types/database';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, post }) => {
  const [copied, setCopied] = useState(false);

  if (!post) return null;

  const postUrl = `${window.location.origin}/u/${post.author?.username || 'post'}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Share Post" maxWidth="sm">
      <div className="flex flex-col gap-4 py-2">
        <p className="text-xs text-[#B0B3BD] leading-relaxed">
          Share this skill tutorial with your friends or study groups:
        </p>

        <div className="flex items-center gap-2 p-2 rounded-[10px] bg-[#1B1D24] border border-[#292B34]">
          <input
            type="text"
            readOnly
            value={postUrl}
            className="flex-1 bg-transparent text-xs text-[#F5F5F7] focus:outline-none select-all truncate"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#E5484D] hover:bg-[#D7373F] text-white text-xs font-semibold transition-colors shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {navigator.share && (
          <Button
            variant="secondary"
            size="md"
            leftIcon={<Share2 className="w-4 h-4" />}
            onClick={() => {
              navigator.share({
                title: 'UPMIND Post',
                text: post.caption,
                url: postUrl,
              }).catch(() => {});
            }}
          >
            Share via System Dialog
          </Button>
        )}
      </div>
    </Dialog>
  );
};
