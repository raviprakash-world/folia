import { lazy, Suspense, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { PageLoader } from '@/components/common/PageLoader';

const SearchOverlayContent = lazy(() =>
  import('./SearchOverlayContent').then((m) => ({ default: m.SearchOverlayContent }))
);

export function SearchOverlay() {
  const open = useUIStore((s) => s.searchOverlayOpen);
  const openSearchOverlay = useUIStore((s) => s.openSearchOverlay);
  const closeSearchOverlay = useUIStore((s) => s.closeSearchOverlay);
  const containerRef = useRef<HTMLDivElement>(null);

  // SearchOverlayContent focuses its own input directly once it mounts, so
  // the trap shouldn't also try to auto-focus "the first focusable element"
  // (which would race it and could land on the wrong thing while lazy
  // content is still loading).
  useFocusTrap(containerRef, open, closeSearchOverlay, { skipAutoFocus: true });

  // Always-active global shortcut — this component never unmounts, so ⌘K /
  // Ctrl+K works from anywhere in the app, not just when a search icon is visible.
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchOverlay();
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [openSearchOverlay]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSearchOverlay}
            className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed top-0 left-0 right-0 z-50 bg-stone-light border-b border-stone-dark shadow-[var(--shadow-lifted)] max-h-[85vh] overflow-y-auto"
          >
            <Suspense fallback={<PageLoader />}>
              <SearchOverlayContent onClose={closeSearchOverlay} />
            </Suspense>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
