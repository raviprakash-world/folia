import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Card } from '@/components/ui/Card';
import { ArrowRight } from 'lucide-react';

/**
 * Phase 1 placeholder — proves out the token system (color, type, radius,
 * shadow, the Tag signature element) end to end before Phase 2 builds the
 * real hero, carousels, and homepage sections on top of it.
 */
export default function Home() {
  return (
    <>
      <section className="bg-pine text-stone-light">
        <Container className="py-24 md:py-32 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Tag tone="ochre" tilted>New season</Tag>
            <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] mt-5">
              Living design for the home.
            </h1>
            <p className="mt-5 text-stone/75 text-lg max-w-[42ch]">
              Considered plants and vessels, chosen for how they hold light in a room —
              not just how they photograph.
            </p>
            <div className="mt-8 flex gap-3">
              <Button variant="secondary" size="lg" icon={<ArrowRight size={18} />} iconPosition="right">
                <Link to="/shop">Shop the collection</Link>
              </Button>
              <Button variant="outline" size="lg" className="!text-stone-light !border-stone-light hover:!bg-stone-light hover:!text-pine">
                <Link to="/about">Our approach</Link>
              </Button>
            </div>
          </div>
          <div className="aspect-[4/5] rounded-[var(--radius-card)] bg-fern/30 border border-stone-light/10 flex items-center justify-center">
            <span className="font-mono text-xs text-stone-light/50 uppercase tracking-wider">
              Hero image placeholder
            </span>
          </div>
        </Container>
      </section>

      <Container className="py-20">
        <div className="flex items-end justify-between mb-8">
          <h2 className="font-display text-3xl font-semibold text-pine">Design system check</h2>
          <span className="font-mono text-xs text-ink-soft uppercase tracking-wider">Phase 1</span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { name: 'Monstera Deliciosa', price: '$68', tone: 'ochre' as const, badge: 'Bestseller' },
            { name: 'Ceramic Vessel — Ash', price: '$42', tone: 'rust' as const, badge: 'Sale' },
            { name: 'Fiddle Leaf Fig', price: '$95', tone: 'pine' as const, badge: 'New' },
          ].map((item) => (
            <Card key={item.name} variant="raised" className="p-5">
              <div className="aspect-square rounded-[var(--radius-control)] bg-stone-dark mb-4" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-ink">{item.name}</h3>
                  <p className="font-mono text-sm text-ink-soft mt-1">{item.price}</p>
                </div>
                <Tag tone={item.tone}>{item.badge}</Tag>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </>
  );
}
