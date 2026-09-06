import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { verifyEmail } from '@/services/authService';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error');
  const [errorMessage, setErrorMessage] = useState<string | null>(
    token ? null : 'This link is missing its verification token.'
  );

  useEffect(() => {
    if (!token) return;
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'That verification link is invalid or has expired.'
        );
      });
  }, [token]);

  if (status === 'verifying') {
    return (
      <Container className="py-20 max-w-sm text-center">
        <p className="text-sm text-ink-soft">Verifying your email…</p>
      </Container>
    );
  }

  if (status === 'error') {
    return (
      <Container className="py-20 max-w-sm text-center">
        <XCircle size={28} className="text-rust mx-auto mb-4" />
        <h1 className="font-display text-2xl font-semibold text-heading">Couldn't verify your email</h1>
        <p className="text-sm text-ink-soft mt-2">{errorMessage}</p>
        <Button variant="primary" className="mt-6">
          <Link to="/account">Go to your account</Link>
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-20 max-w-sm text-center">
      <CheckCircle2 size={28} className="text-fern mx-auto mb-4" />
      <h1 className="font-display text-2xl font-semibold text-heading">Email verified</h1>
      <p className="text-sm text-ink-soft mt-2">Your email address has been confirmed.</p>
      <Button variant="primary" className="mt-6">
        <Link to="/account">Go to your account</Link>
      </Button>
    </Container>
  );
}
