import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Tag } from '@/components/ui/Tag';
import type { BlogPost } from '@/types/blog';

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link to={`/blog/${post.slug}`} className="group flex flex-col">
      <div className="aspect-[4/3] rounded-[var(--radius-card)] bg-stone-dark mb-4" />
      <Tag tone="stone" className="self-start mb-3">
        {post.category}
      </Tag>
      <h3 className="font-medium text-ink group-hover:text-fern transition-colors leading-snug">
        {post.title}
      </h3>
      <p className="text-sm text-ink-soft mt-1.5 line-clamp-2">{post.excerpt}</p>
      <div className="flex items-center gap-3 text-xs text-ink-soft mt-3 font-mono">
        <span>{post.author}</span>
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {post.readTimeMinutes} min read
        </span>
      </div>
    </Link>
  );
}
