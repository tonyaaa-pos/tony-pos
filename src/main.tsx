import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Global error protection against unhandled network or API rejections at startup
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[KinD POS Handled UnhandledRejection]:', event.reason);
    // Prevent unhandled promise errors from breaking the page render
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    console.warn('[KinD POS Global Error Caught]:', event.error || event.message);
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} else {
  console.error('[KinD POS] Fatal: Root element #root not found in document');
}

// In development, actively clear any previous service worker registration to prevent stale cache intercepting Vite modules
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    }).catch(() => {});
  } else if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }
}
