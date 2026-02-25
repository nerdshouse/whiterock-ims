import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('No #root element')

try {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (err) {
  console.error(err)
  rootEl.innerHTML = `<div style="padding:24px;font-family:system-ui"><h1 style="color:#b91c1c">App failed to start</h1><pre style="background:#fef2f2;padding:12px;border-radius:6px;overflow:auto">${err.message}</pre><p style="color:#666;margin-top:12px">Check the browser console (F12) for details.</p></div>`
}
