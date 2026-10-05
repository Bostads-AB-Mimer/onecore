import '@onecore/ui/styles.css'
import faviconUrl from '@onecore/ui/assets/onecore_simple_black.svg'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'

// The favicon comes from the shared UI lib, so it is set here rather than in index.html.
const favicon = document.createElement('link')
favicon.rel = 'icon'
favicon.type = 'image/svg+xml'
favicon.href = faviconUrl
document.head.appendChild(favicon)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
