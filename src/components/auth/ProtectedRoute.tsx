import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { PageLoader } from '@/components/common/PageLoader';

export function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const location = useLocation();

  if (!hasHydrated) return <PageLoader />;

  if (!user) {
    return <Navigate to="/account/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
