import { Users, UserCheck, UserPlus, Repeat, DollarSign, Award, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { TableWidget } from '@/components/admin/TableWidget';
import { useCustomerAnalytics, useRealAdminApi } from '@/hooks/useAdminAnalytics';
import { fetchAdminUsers, updateAdminUserRole, deactivateAdminUser } from '@/services/adminApiService';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency } from '@/utils/currency';
import type { User } from '@/types/auth';

const USERS_QUERY_KEY = ['admin-users-list'];

export default function AdminCustomers() {
  const customers = useCustomerAnalytics();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: users = [] } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: fetchAdminUsers,
    enabled: useRealAdminApi,
  });
  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'customer' | 'admin' }) => updateAdminUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });
  const deactivateMutation = useMutation({
    mutationFn: deactivateAdminUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }),
  });

  return (
    <div>
      <PageHeader
        title="Customer Analytics"
        description={
          useRealAdminApi
            ? 'Live customer counts and repeat-purchase rate from the store database.'
            : 'Total customers combines a deterministic mock platform baseline with your real session — this client-only app has no real multi-customer backend, so this is honestly labeled rather than presented as live data.'
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <StatCard label="Total customers" value={customers.totalCustomers} Icon={Users} />
        {useRealAdminApi ? (
          <>
            <StatCard label="Repeat customers" value={customers.repeatCustomers} Icon={Repeat} />
            <StatCard label="Repeat purchase rate" value={`${customers.repeatPurchaseRate}%`} Icon={ShieldCheck} />
          </>
        ) : (
          <>
            <StatCard label="Active customers (30d)" value={customers.activeCustomers} Icon={UserCheck} />
            <StatCard label="New customers (30d)" value={customers.newCustomers} Icon={UserPlus} />
          </>
        )}
        <StatCard label="Average order value" value={formatCurrency(customers.averageOrderValue)} Icon={DollarSign} />
        {!useRealAdminApi && <StatCard label="Lifetime value (mock)" value={formatCurrency(customers.lifetimeValue)} Icon={Award} />}
      </div>

      {useRealAdminApi ? (
        <div>
          <h2 className="font-display text-lg font-semibold text-heading mb-4">Manage users</h2>
          <TableWidget
            caption="All registered users with role and account actions"
            emptyMessage="No users yet."
            rows={users}
            keyExtractor={(u: User) => u.id}
            columns={[
              { key: 'name', label: 'Name', render: (u: User) => `${u.firstName} ${u.lastName}` },
              { key: 'email', label: 'Email', render: (u: User) => u.email },
              { key: 'role', label: 'Role', render: (u: User) => u.role ?? 'customer' },
              {
                key: 'actions',
                label: 'Actions',
                render: (u: User) => {
                  const isSelf = u.id === currentUserId;
                  const nextRole = (u.role ?? 'customer') === 'admin' ? 'customer' : 'admin';
                  return (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => roleMutation.mutate({ id: u.id, role: nextRole })}
                        disabled={isSelf || roleMutation.isPending}
                        title={isSelf ? "You can't change your own role" : undefined}
                        className="text-xs px-2.5 py-1 rounded-full border border-stone-dark hover:border-fern disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Make {nextRole}
                      </button>
                      <button
                        type="button"
                        onClick={() => deactivateMutation.mutate(u.id)}
                        disabled={isSelf || deactivateMutation.isPending}
                        title={isSelf ? "You can't deactivate your own account" : undefined}
                        className="text-xs px-2.5 py-1 rounded-full border border-stone-dark hover:border-rust hover:text-rust disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Deactivate
                      </button>
                    </div>
                  );
                },
              },
            ]}
          />
        </div>
      ) : (
        <p className="text-sm text-ink-soft">
          User management actions require the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      )}
    </div>
  );
}
