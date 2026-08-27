import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { Tag } from '@/components/ui/Tag';
import type { BlogPost } from '@/types/blog';

export function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group grid md:grid-cols-2 gap-8 items-center rounded-[var(--radius-card)] bg-stone-light border border-stone-dark p-6 md:p-8 mb-14"
    >
      <div className="aspect-[4/3] rounded-[var(--radius-control)] bg-stone-dark" />
      <div>
        <Tag tone="ochre" tilted className="mb-3">
          Featured
        </Tag>
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-pine leading-tight group-hover:text-fern transition-colors">
          {post.title}
        </h2>
        <p className="text-ink-soft mt-3">{post.excerpt}</p>
        <div className="flex items-center gap-3 text-xs text-ink-soft mt-4 font-mono">
          <span>{post.author}</span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {post.readTimeMinutes} min read
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fern mt-5">
          Read the article
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
