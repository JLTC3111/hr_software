import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Industry design system typeface: Barlow for body, Barlow Condensed for
// display/figures. Loaded locally so the console renders offline.
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import './index.css'
import React from 'react'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { ThemeProvider } from './contexts/ThemeContext'

// Suppress browser extension errors
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('chrome-extension://')) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return true;
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message && e.reason.message.includes('chrome-extension://')) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return true;
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
)
