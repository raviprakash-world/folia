import { useEffect } from 'react';
import { useResolvedTheme, useThemeStore } from '@/store/themeStore';

export function useThemeSync() {
  const resolvedTheme = useResolvedTheme();
  const setSystemPrefersDark = useThemeStore((s) => s.setSystemPrefersDark);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [setSystemPrefersDark]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);
}
