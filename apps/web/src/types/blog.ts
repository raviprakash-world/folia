export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string[];
  category: string;
  tags: string[];
  author: string;
  readTimeMinutes: number;
  publishedAt: string;
  featured: boolean;
}
