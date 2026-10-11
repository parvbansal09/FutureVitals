import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { isNative } from './platform/native';
import { onIdle } from './platform/idle';
import { warmFormatters } from './engine/format';
import { IN_ARTIFACT } from './platform/env';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/print.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Date and number formatters are slow to build the first time, so they are
// built in a quiet moment after start, not in the middle of a tap.
onIdle(warmFormatters, 3000);

// The offline worker is for the web version only: the native app already
// carries every file inside it.
if (import.meta.env.PROD && !IN_ARTIFACT && 'serviceWorker' in navigator && !isNative() && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
