import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';

export default function NotFound() {
  return (
    <Container className="py-32 text-center">
      <div className="flex justify-center mb-6">
        <Tag tone="rust" tilted>404</Tag>
      </div>
      <h1 className="font-display text-4xl font-semibold text-heading">This page didn't take root.</h1>
      <p className="mt-3 text-ink-soft max-w-[46ch] mx-auto">
        The page you're looking for doesn't exist, or the link's out of date. Try the shop,
        or head back home.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button variant="primary">
          <Link to="/">Back home</Link>
        </Button>
        <Button variant="outline">
          <Link to="/shop">Browse shop</Link>
        </Button>
      </div>
    </Container>
  );
}
