import { getHighlightRanges } from '@/utils/textMatch';

export function HighlightText({ text, query }: { text: string; query: string }) {
  const ranges = getHighlightRanges(text, query);
  return (
    <>
      {ranges.map((range, i) =>
        range.matched ? (
          <mark key={i} className="bg-ochre/30 text-ink rounded-sm px-0.5">
            {range.text}
          </mark>
        ) : (
          <span key={i}>{range.text}</span>
        )
      )}
    </>
  );
}
