import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { enableMocking } from './mocks';

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// If MSW fails to start (e.g. the service worker script is blocked), the app
// still renders — a broken mock backend shouldn't mean a blank screen.
enableMocking()
  .then(renderApp)
  .catch((error: unknown) => {
    console.error('Mock service worker failed to start:', error);
    renderApp();
  });
