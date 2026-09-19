import { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { TableWidget } from '@/components/admin/TableWidget';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { useAdminEnquiries, useMarkEnquiryHandled, useRealAdminApi } from '@/hooks/useAdminEnquiries';
import { formatDate } from '@/utils/currency';
import type { AdminEnquiry, EnquiryStatus, EnquiryType } from '@/services/adminEnquiriesApiService';

const PAGE_SIZE = 20;

const typeLabel: Record<EnquiryType, string> = {
  GENERAL: 'Contact form',
  GARDENING_SERVICE: 'Gardening service',
  CORPORATE_GIFTING: 'Corporate gifts',
};
const typeTone: Record<EnquiryType, 'stone' | 'pine' | 'ochre'> = {
  GENERAL: 'stone',
  GARDENING_SERVICE: 'pine',
  CORPORATE_GIFTING: 'ochre',
};

const detailLabels: Record<string, string> = {
  city: 'City',
  serviceType: 'Service',
  company: 'Company',
  quantity: 'Quantity',
  occasion: 'Occasion',
  neededBy: 'Needed by',
};

function EnquiryMessage({ enquiry }: { enquiry: AdminEnquiry }) {
  const preview = enquiry.message.length > 70 ? `${enquiry.message.slice(0, 70)}…` : enquiry.message;
  return (
    <details className="max-w-md">
      <summary className="cursor-pointer text-ink">
        {enquiry.subject ? <strong className="font-medium">{enquiry.subject} — </strong> : null}
        {preview}
      </summary>
      <p className="mt-2 whitespace-pre-wrap text-ink-soft">{enquiry.message}</p>
      {enquiry.details && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {Object.entries(enquiry.details).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-ink-soft">{detailLabels[key] ?? key}</dt>
              <dd className="text-ink">{String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </details>
  );
}

export default function AdminEnquiries() {
  const [status, setStatus] = useState<EnquiryStatus>('NEW');
  const [page, setPage] = useState(1);
  const { items, total, isLoading } = useAdminEnquiries(status, page, PAGE_SIZE);
  const markHandled = useMarkEnquiryHandled();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function selectStatus(next: EnquiryStatus) {
    setStatus(next);
    setPage(1);
  }

  return (
    <div>
      <PageHeader title="Enquiries" description="Messages from the contact form, gardening-service requests and corporate-gift quotes." />

      {useRealAdminApi ? (
        <>
          <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Filter by status">
            {(['NEW', 'HANDLED'] as EnquiryStatus[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={status === tab}
                onClick={() => selectStatus(tab)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  status === tab ? 'border-fern bg-fern text-stone-light' : 'border-stone-dark text-ink-soft hover:border-fern'
                }`}
              >
                {tab === 'NEW' ? 'New' : 'Handled'}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
          ) : (
            <TableWidget
              caption={`${status === 'NEW' ? 'New' : 'Handled'} enquiries`}
              emptyMessage={status === 'NEW' ? 'No new enquiries.' : 'Nothing has been marked handled yet.'}
              rows={items}
              keyExtractor={(e: AdminEnquiry) => e.id}
              columns={[
                { key: 'received', label: 'Received', render: (e: AdminEnquiry) => formatDate(e.createdAt) },
                { key: 'type', label: 'Type', render: (e: AdminEnquiry) => <Tag tone={typeTone[e.type]}>{typeLabel[e.type]}</Tag> },
                {
                  key: 'from',
                  label: 'From',
                  render: (e: AdminEnquiry) => (
                    <div>
                      <p className="text-ink">{e.name}</p>
                      <a href={`mailto:${e.email}`} className="text-fern underline">
                        {e.email}
                      </a>
                      {e.phone && <p className="text-ink-soft">{e.phone}</p>}
                    </div>
                  ),
                },
                { key: 'message', label: 'Message', render: (e: AdminEnquiry) => <EnquiryMessage enquiry={e} /> },
                {
                  key: 'action',
                  label: '',
                  align: 'right',
                  render: (e: AdminEnquiry) =>
                    e.status === 'NEW' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={markHandled.isPending}
                        onClick={() => markHandled.mutate(e.id)}
                      >
                        Mark handled
                      </Button>
                    ) : null,
                },
              ]}
            />
          )}
          {markHandled.isError && <p className="text-sm text-rust mt-3">Couldn&apos;t update that enquiry. Please try again.</p>}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <p className="mt-10 text-sm text-ink-soft">
          Enquiries are stored by the real backend (set <code>VITE_REAL_ADMIN_API=true</code>).
        </p>
      )}
    </div>
  );
}
