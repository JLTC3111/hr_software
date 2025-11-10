import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import React from 'react'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

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
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
