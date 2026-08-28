import { useParams, Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { policies } from '@/data/policies';

export default function Policy() {
  const { slug } = useParams<{ slug: string }>();
  const policy = policies.find((p) => p.slug === slug);

  if (!policy) {
    return (
      <Container className="py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-heading">Page not found</h1>
        <p className="text-ink-soft mt-2">
          <Link to="/" className="text-fern underline">Back home</Link>.
        </p>
      </Container>
    );
  }

  return (
    <Container className="py-16 max-w-2xl">
      <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: policy.title }]} />
      <h1 className="font-display text-4xl font-semibold text-heading">{policy.title}</h1>
      <p className="font-mono text-xs text-ink-soft mt-2">Last updated {policy.updatedAt}</p>

      <div className="flex flex-col gap-8 mt-10">
        {policy.sections.map((section) => (
          <div key={section.heading}>
            <h2 className="font-display text-lg font-semibold text-ink mb-2">{section.heading}</h2>
            <p className="text-sm text-ink-soft leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>
    </Container>
  );
}
