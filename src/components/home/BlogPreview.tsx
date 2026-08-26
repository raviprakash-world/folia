import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { blogPreview } from '@/data/homepage';

export function BlogPreview() {
  return (
    <Container className="py-20">
      <SectionHeading
        eyebrow="The journal"
        title="Notes on plant care"
        action={
          <Link to="/blog" className="text-sm font-medium text-fern hover:text-pine transition-colors">
            Read the journal
          </Link>
        }
      />
      <div className="grid sm:grid-cols-3 gap-6">
        {blogPreview.map((post) => (
          <Link key={post.slug} to={`/blog/${post.slug}`} className="group">
            <div className="aspect-[4/3] rounded-[var(--radius-card)] bg-stone-dark mb-4" />
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
