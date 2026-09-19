import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { ProductImage } from '@/components/product/ProductImage';
import { services } from '@/data/services';

export function ServiceCards() {
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      {services.map((service) => (
        <Link
          key={service.slug}
          to={service.to}
          className="group relative aspect-[4/3] rounded-[var(--radius-card)] bg-fern/25 border border-stone-dark overflow-hidden flex flex-col justify-end p-6"
        >
          <ProductImage src={service.image} alt="" className="transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" aria-hidden="true" />
          <ArrowUpRight size={20} className="absolute top-5 right-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="relative font-display text-2xl font-semibold text-white">{service.title}</h3>
          <p className="relative text-sm text-white/85 mt-1">{service.description}</p>
          <span className="relative text-sm font-medium text-white mt-3 underline underline-offset-4">{service.cta}</span>
        </Link>
      ))}
    </div>
  );
}
