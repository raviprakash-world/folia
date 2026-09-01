import { Users, UserCheck, UserPlus, Repeat, DollarSign, Award } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { useCustomerAnalytics } from '@/hooks/useAdminAnalytics';
import { formatCurrency } from '@/utils/currency';

export default function AdminCustomers() {
  const customers = useCustomerAnalytics();

  return (
    <div>
      <PageHeader
        title="Customer Analytics"
        description="Total customers combines a deterministic mock platform baseline with your real session — this client-only app has no real multi-customer backend, so this is honestly labeled rather than presented as live data."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total customers" value={customers.totalCustomers} Icon={Users} />
        <StatCard label="Active customers (30d)" value={customers.activeCustomers} Icon={UserCheck} />
        <StatCard label="New customers (30d)" value={customers.newCustomers} Icon={UserPlus} />
        <StatCard label="Returning customers" value={customers.returningCustomers} Icon={Repeat} />
        <StatCard label="Average order value" value={formatCurrency(customers.averageOrderValue)} Icon={DollarSign} />
        <StatCard label="Lifetime value (mock)" value={formatCurrency(customers.lifetimeValue)} Icon={Award} />
      </div>
    </div>
  );
}
