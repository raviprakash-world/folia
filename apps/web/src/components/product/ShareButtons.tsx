import { useState } from 'react';
import { Share2, Link2, Check } from 'lucide-react';

interface ShareButtonsProps {
  title: string;
  url: string;
}

export function ShareButtons({ title, url }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  async function handleShare() {
    if (canNativeShare) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled the native share sheet — not an error worth surfacing
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className="flex min-h-11 items-center gap-2 text-[15px] text-ink-soft transition-colors hover:text-heading"
    >
      {copied ? <Check size={15} className="text-fern" /> : canNativeShare ? <Share2 size={15} /> : <Link2 size={15} />}
      {copied ? 'Link copied' : canNativeShare ? 'Share' : 'Copy link'}
    </button>
  );
}
