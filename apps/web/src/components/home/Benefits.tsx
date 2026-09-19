import { Container } from '@/components/ui/Container';
import { benefits } from '@/data/homepage';

export function Benefits() {
  return (
    <div className="bg-pine text-cream">
      <Container className="py-16 grid sm:grid-cols-3 gap-10">
        {benefits.map((benefit) => (
          <div key={benefit.title} className="border-l border-stone/20 pl-5">
            <h3 className="font-display text-lg font-semibold">{benefit.title}</h3>
            <p className="text-sm text-cream/70 mt-2">{benefit.description}</p>
          </div>
        ))}
      </Container>
    </div>
  );
}
