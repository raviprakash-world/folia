import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function toCsv<T extends object>(rows: T[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] as object);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => JSON.stringify((row as Record<string, unknown>)[h] ?? '')).join(',')),
  ];
  return lines.join('\n');
}

interface ExportButtonProps<T extends object> {
  data: T[];
  filename: string;
}

export function ExportButton<T extends object>({ data, filename }: ExportButtonProps<T>) {
  function handleExport() {
    const csv = toCsv(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" icon={<Download size={14} />} disabled={data.length === 0} onClick={handleExport}>
      Export CSV
    </Button>
  );
}
