import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';

export default function ProductDetail() {
  const { slug } = useParams();
  return <PlaceholderPage title={`Product: ${slug}`} phase="Phase 3" description="Gallery, variants, reviews, and related products land in Phase 3." />;
}
