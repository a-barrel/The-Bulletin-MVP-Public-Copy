import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { NetworkStatusProvider } from './contexts/NetworkStatusContext.jsx';
import { installTelemetryGuards } from './utils/suppressTelemetryNoise.js';
import { installClientErrorListeners } from './utils/clientLogger.js';
import { installStyleWarningFilter } from './utils/styleWarningFilter.js';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config.js';
import LanguageHotkeys from './i18n/LanguageHotkeys.jsx';
import { ThemePreferenceProvider } from './contexts/ThemePreferenceContext.jsx';

installTelemetryGuards();
installClientErrorListeners();
installStyleWarningFilter();

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
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <AppErrorBoundary>
          <NetworkStatusProvider>
            <ThemePreferenceProvider>
              <LanguageHotkeys />
              <App />
            </ThemePreferenceProvider>
          </NetworkStatusProvider>
        </AppErrorBoundary>
      </BrowserRouter>
    </I18nextProvider>
  </StrictMode>
);
