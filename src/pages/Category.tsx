import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';

export default function Category() {
  const { slug } = useParams();
  return <PlaceholderPage title={`Category: ${slug}`} phase="Phase 3" description="Category-filtered listing lands in Phase 3." />;
}
