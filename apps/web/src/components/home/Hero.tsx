import { Container } from '@/components/ui/Container';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { ProductImage } from '@/components/product/ProductImage';

const HERO_PHOTO = '/demo/products/monstera-deliciosa.jpg';

/** Phone: the photo sits behind the copy so the first screen is image-led and short. Tablet and up: copy left, photo right. */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-pine text-cream-light">
      <img
        src={HERO_PHOTO}
        alt=""
        width={800}
        height={800}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 -z-20 h-full w-full object-cover md:hidden"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-pine via-pine/75 to-pine/25 md:hidden" />

      <Container className="grid min-h-[25rem] items-end gap-10 pb-8 pt-16 md:min-h-0 md:grid-cols-2 md:items-center md:py-20 lg:py-28">
        <div>
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-ochre-light">Plants · Planters · Gardening</p>
          <h1 className="font-display text-[2.5rem] font-semibold leading-[1.05] md:text-6xl">Bring more green home.</h1>
          <p className="mt-3 max-w-[36ch] text-[17px] leading-relaxed text-cream/90 md:mt-5 md:text-lg">
            Plants, planters and everything you need to grow beautifully.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:flex md:mt-8">
            <ButtonLink to="/collections/plants" variant="secondary" size="lg">
              Shop plants
            </ButtonLink>
            <ButtonLink
              to="/collections/vessels"
              variant="outline"
              size="lg"
              className="!border-cream-light !text-cream-light hover:!bg-stone-light hover:!text-heading"
            >
              Explore planters
            </ButtonLink>
          </div>
        </div>
        <div className="relative hidden aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] border border-stone-light/10 bg-fern/30 md:block">
          <ProductImage src={HERO_PHOTO} alt="A healthy Monstera deliciosa with large split leaves" />
        </div>
      </Container>
    </section>
  );
}
