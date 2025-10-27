import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { NetworkStatusProvider } from './contexts/NetworkStatusContext.jsx';

if (import.meta.hot && typeof window !== 'undefined') {
  const SUPPRESS_KEY = '__pinpoint_suppressed_fast_refresh__';
  if (!window[SUPPRESS_KEY]) {
    window[SUPPRESS_KEY] = true;
    const originalWarn = console.warn.bind(console);
    const suppressedFragments = [
      'Fast Refresh is not compatible with this shim',
      'Could not Fast Refresh'
    ];
    console.warn = (...args) => {
      const first = args[0];
      if (typeof first === 'string' && suppressedFragments.some((fragment) => first.includes(fragment))) {
        return;
      }
      originalWarn(...args);
    };
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppErrorBoundary>
        <NetworkStatusProvider>
          <App />
        </NetworkStatusProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);
