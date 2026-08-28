import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { PageLoader } from '@/components/common/PageLoader';

interface ProtectedRouteProps {
  requireRole?: 'admin';
  redirectTo?: string;
}

export function ProtectedRoute({ requireRole, redirectTo = '/account/login' }: ProtectedRouteProps = {}) {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const location = useLocation();

  if (!hasHydrated) return <PageLoader />;

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requireRole && user.role !== requireRole) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
