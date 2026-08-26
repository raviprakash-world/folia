import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';

export default function Policy() {
  const { slug } = useParams();
  return <PlaceholderPage title={`Policy: ${slug}`} phase="Phase 5" />;
}
