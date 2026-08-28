import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/common/PageHeader';
import { Accordion } from '@/components/common/Accordion';
import { EmptyState } from '@/components/common/EmptyState';
import { faqEntries, faqCategories } from '@/data/faq';

export default function FAQ() {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? faqEntries.filter(
          (e) =>
            e.question.toLowerCase().includes(normalized) ||
            e.answer.toLowerCase().includes(normalized) ||
            e.category.toLowerCase().includes(normalized)
        )
      : faqEntries;

    return faqCategories
      .map((category) => ({
        category,
        entries: filtered.filter((e) => e.category === category),
      }))
      .filter((group) => group.entries.length > 0);
  }, [query]);

  return (
    <Container className="py-16 max-w-3xl">
      <PageHeader
        eyebrow="Support"
        title="Frequently asked questions"
        description="Can't find what you need? Reach out through Contact — a real person reads every message."
      />

      <div className="relative mb-10">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions…"
          aria-label="Search FAQ"
          className="w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light pl-10 pr-4 py-2.5 text-sm focus:border-fern transition-colors"
        />
      </div>

      {grouped.length === 0 ? (
        <EmptyState title="No matching questions" description="Try a different search term, or browse by clearing the search." />
      ) : (
        <div className="flex flex-col gap-10">
          {grouped.map((group) => (
            <div key={group.category}>
              <h2 className="font-display text-xl font-semibold text-heading mb-2">{group.category}</h2>
              <Accordion items={group.entries.map((e) => ({ question: e.question, answer: e.answer }))} />
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
