/**
 * Starts the MSW mock server in development. In production this is a no-op —
 * swap the /api/* handlers for a real backend and nothing else in the app
 * needs to change, since the service layer (src/services/) already talks to
 * relative /api/* URLs.
 */
export async function enableMocking() {
  if (!import.meta.env.DEV) return;

  const { worker } = await import('./browser');
  return worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
}
