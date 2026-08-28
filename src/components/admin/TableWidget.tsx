import type { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

interface TableWidgetProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  caption: string;
}

export function TableWidget<T>({ columns, rows, keyExtractor, emptyMessage = 'No data yet.', caption }: TableWidgetProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-soft py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-stone-dark">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`py-2 px-3 font-mono text-xs uppercase tracking-wider text-ink-soft ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyExtractor(row)} className="border-b border-stone-dark/60 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className={`py-2.5 px-3 text-ink ${col.align === 'right' ? 'text-right font-mono' : ''}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
