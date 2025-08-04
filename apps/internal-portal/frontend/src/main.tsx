import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container) // createRoot(container!) if you use TypeScript
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
}
