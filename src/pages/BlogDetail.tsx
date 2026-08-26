import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';

export default function BlogDetail() {
  const { slug } = useParams();
  return <PlaceholderPage title={`Journal: ${slug}`} phase="Phase 5" />;
}
