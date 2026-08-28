import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/common/PageHeader';

const values = [
  {
    title: 'Grown, not warehoused',
    body: 'Every plant ships from a partner nursery on its own schedule — we don\u2019t hold stock in a warehouse waiting for demand, which is why availability shifts week to week.',
  },
  {
    title: 'Honest about care difficulty',
    body: 'We\u2019d rather tell you a plant is genuinely fussy than sell it as beginner-friendly and have it die in your hallway three weeks later.',
  },
  {
    title: 'Sized to actually work',
    body: 'Vessels are matched to real plant sizes, not sold as generic decor — the goal is a pot that fits, not just one that photographs well.',
  },
];

export default function About() {
  return (
    <>
      <div className="bg-pine text-stone-light">
        <Container className="py-24">
          <p className="font-mono text-xs uppercase tracking-wider text-ochre mb-4">About Folia</p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold max-w-[20ch] leading-tight">
            We think a plant should still be alive a year after you buy it.
          </h1>
          <p className="text-stone/75 mt-5 max-w-[60ch] text-lg">
            That sounds obvious. It isn't how most plant shops operate — optimized for the
            unboxing photo, not the following spring. We built Folia around the opposite bet.
          </p>
        </Container>
      </div>

      <Container className="py-20">
        <PageHeader eyebrow="What we believe" title="A few things we won't compromise on" />
        <div className="grid sm:grid-cols-3 gap-8">
          {values.map((v) => (
            <div key={v.title}>
              <h3 className="font-display text-lg font-semibold text-heading">{v.title}</h3>
              <p className="text-sm text-ink-soft mt-2 leading-relaxed">{v.body}</p>
            </div>
          ))}
        </div>
      </Container>

      <Container className="py-8 pb-24">
        <div className="rounded-[var(--radius-card)] bg-stone-dark/40 p-10 text-center">
          <h2 className="font-display text-2xl font-semibold text-heading">Have a question before you order?</h2>
          <p className="text-ink-soft mt-2 max-w-[50ch] mx-auto">
            We answer care questions even if you haven't bought anything yet — happy to help you figure out what'll actually survive your space.
          </p>
          <Button variant="primary" className="mt-6">
            <Link to="/contact">Get in touch</Link>
          </Button>
        </div>
      </Container>
    </>
  );
}
