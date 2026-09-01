import { Search, SearchX, MousePointerClick, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/admin/StatCard';
import { BarChartWidget } from '@/components/admin/charts/BarChartWidget';
import { TableWidget } from '@/components/admin/TableWidget';
import { ExportButton } from '@/components/admin/ExportButton';
import { useSearchAnalytics } from '@/hooks/useAdminAnalytics';
import { getTrendingSearches } from '@/data/trendingSearches';
import type { TableColumn } from '@/components/admin/TableWidget';
import type { SearchTermMetric } from '@/utils/analytics';

const columns: TableColumn<SearchTermMetric>[] = [
  { key: 'term', label: 'Search term', render: (row) => row.term },
  { key: 'count', label: 'Count', align: 'right', render: (row) => row.count },
];

export default function AdminSearch() {
  const { topSearches, noResultSearches, conversion } = useSearchAnalytics();
  const trending = getTrendingSearches();

  return (
    <div>
      <PageHeader
        title="Search Analytics"
        description="Top and trending searches combine a deterministic mock baseline with real terms searched in this session. No-result searches and click-through rate are computed entirely from real logged search events."
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <StatCard label="Searches logged (session)" value={conversion.totalSearches} Icon={Search} />
        <StatCard label="Searches with a click" value={conversion.searchesWithClick} Icon={MousePointerClick} />
        <StatCard label="Click-through rate" value={`${conversion.clickThroughRate}%`} Icon={TrendingUp} />
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mb-10">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-heading">Top searches</h2>
            <ExportButton data={topSearches} filename="top-searches" />
          </div>
          <BarChartWidget
            data={topSearches}
            series={[{ key: 'count', label: 'Searches', color: 'var(--color-fern)' }]}
            xKey="term"
            layout="vertical"
            description={`Top ${topSearches.length} search terms by frequency.`}
          />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-heading mb-4 flex items-center gap-2">
            <SearchX size={16} className="text-rust" />
            No-result searches (session)
          </h2>
          <TableWidget
            columns={columns}
            rows={noResultSearches}
            keyExtractor={(r) => r.term}
            caption="Searches in this session that returned zero results"
            emptyMessage="No zero-result searches logged in this session yet — try searching for something unusual."
          />
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-heading mb-3">Currently trending (rotates every 3 days)</h2>
        <div className="flex flex-wrap gap-2">
          {trending.map((term) => (
            <span key={term} className="px-3 py-1.5 rounded-full border border-stone-dark text-sm text-ink-soft">
              {term}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
