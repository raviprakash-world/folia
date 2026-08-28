import { useEffect, useState } from 'react';

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * recharts animates chart mount/update via its own internal
 * requestAnimationFrame logic, not CSS — so the global
 * `@media (prefers-reduced-motion: reduce)` override in index.css (which
 * only disables CSS transitions/animations) has no effect on it. Chart
 * widgets read this and pass `isAnimationActive={false}` when true.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(getPrefersReducedMotion);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return prefersReduced;
}
