import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from '@/routes';
import { useAuthStore } from '@/store/authStore';
import { useThemeSync } from '@/hooks/useThemeSync';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const refreshSession = useAuthStore((s) => s.refreshSession);
  useThemeSync();

  // Runs once, right after the persisted auth store rehydrates, to verify a
  // saved token is still valid against the mock backend.
  useEffect(() => {
    if (hasHydrated) void refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only re-runs when hydration completes, not on every refreshSession identity change
  }, [hasHydrated]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
