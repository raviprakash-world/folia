import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * P0-D — before this, a render-phase throw anywhere in the component tree
 * (confirmed by reading main.tsx: App rendered directly under StrictMode,
 * no boundary) unmounted the whole app per React's default behavior,
 * leaving the user looking at a blank white page with no way back short
 * of knowing to refresh. Class component because React's error-boundary
 * API (getDerivedStateFromError/componentDidCatch) has no hook
 * equivalent — this is the one place in this codebase that's
 * unavoidable.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No error-tracking service is wired up yet (see docs/SECURITY_STATUS.md /
    // PRODUCTION_STATUS.md — Sentry/equivalent is a documented gap) — this is
    // the only place this error is recorded today.
    console.error('Unhandled error in component tree:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <Container className="py-24 max-w-sm text-center">
        <AlertTriangle size={32} className="mx-auto text-rust" />
        <h1 className="font-display text-2xl font-semibold text-heading mt-4">Something went wrong</h1>
        <p className="text-sm text-ink-soft mt-2">
          This page hit an unexpected error. Reloading usually fixes it — your cart and account are unaffected.
        </p>
        <Button
          variant="primary"
          size="md"
          className="mt-6 mx-auto"
          onClick={() => {
            window.location.href = '/';
          }}
        >
          Back to home
        </Button>
      </Container>
    );
  }
}
