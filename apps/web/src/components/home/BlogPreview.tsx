import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { SectionLink } from '@/components/common/SectionLink';
import { blogPreview } from '@/data/homepage';
import { blogImage } from '@/data/blog';

export function BlogPreview() {
  return (
    <Container className="py-8 sm:py-12">
      <SectionHeading title="From the journal" action={<SectionLink to="/blog">Read more</SectionLink>} />
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {blogPreview.map((post) => (
          <Link key={post.slug} to={`/blog/${post.slug}`} className="group w-64 shrink-0 snap-start sm:w-auto">
            <img src={blogImage(post.slug)} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-[var(--radius-card)] bg-stone-dark object-cover mb-4" />
            <h3 className="font-medium text-ink group-hover:text-fern transition-colors">
              {post.title}
            </h3>
            <p className="text-sm text-ink-soft mt-1.5 line-clamp-2">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </Container>
  );
}
