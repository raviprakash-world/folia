import { Container } from '@/components/ui/Container';
import { Tag } from '@/components/ui/Tag';

interface PlaceholderPageProps {
  title: string;
  phase: string;
  description?: string;
}

/** Marks a route as scaffolded-but-not-yet-built, and which phase will fill it in. */
export function PlaceholderPage({ title, phase, description }: PlaceholderPageProps) {
  return (
    <Container className="py-24">
      <Tag tone="stone">{phase}</Tag>
      <h1 className="font-display text-4xl font-semibold text-pine mt-4">{title}</h1>
      {description && <p className="mt-3 text-ink-soft max-w-[60ch]">{description}</p>}
    </Container>
  );
}
