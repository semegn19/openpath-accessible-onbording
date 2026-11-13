import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Production only. In dev a cached worker fighting Vite's HMR is a debugging trap, and the
// stale-worker-on-the-demo-laptop bug is worse than no worker at all.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* no worker: the form still works, it just cannot be reopened with no signal */
    });
  });
}
