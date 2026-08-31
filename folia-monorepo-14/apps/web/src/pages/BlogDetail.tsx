import { useParams, Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { Tag } from '@/components/ui/Tag';
import { SectionHeading } from '@/components/common/SectionHeading';
import { BlogCard } from '@/components/blog/BlogCard';
import { useBlogPost, useRelatedPosts } from '@/hooks/useBlog';

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const post = useBlogPost(slug);
  const related = useRelatedPosts(slug, post?.category);

  if (!post) {
    return (
      <Container className="py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-heading">Article not found</h1>
        <p className="text-ink-soft mt-2">
          <Link to="/blog" className="text-fern underline">Back to the journal</Link>.
        </p>
      </Container>
    );
  }

  return (
    <Container className="py-16 max-w-2xl">
      <Breadcrumb items={[{ label: 'Journal', to: '/blog' }, { label: post.title }]} />

      <Tag tone="stone" className="mb-4">{post.category}</Tag>
      <h1 className="font-display text-4xl font-semibold text-heading leading-tight">{post.title}</h1>

      <div className="flex items-center gap-3 text-xs text-ink-soft mt-4 font-mono">
        <span>{post.author}</span>
        <span>{post.publishedAt}</span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {post.readTimeMinutes} min read
        </span>
      </div>

      <div className="aspect-[16/9] rounded-[var(--radius-card)] bg-stone-dark my-8" />

      <div className="flex flex-col gap-5">
        {post.content.map((paragraph, i) => (
          <p key={i} className="text-ink-soft leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t border-stone-dark">
        {post.tags.map((tag) => (
          <Tag key={tag} tone="stone">{tag}</Tag>
        ))}
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <SectionHeading title="More from the journal" />
          <div className="grid sm:grid-cols-3 gap-6">
            {related.map((p) => (
              <BlogCard key={p.slug} post={p} />
            ))}
          </div>
        </div>
      )}
    </Container>
  );
}
