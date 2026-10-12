import { onecorePreset } from '@onecore/ui/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [onecorePreset],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Workspace packages rendered inside property-tree
    './node_modules/@onecore/ui/dist/*.js',
    './node_modules/@onecore/leasing-portal-frontend/dist/lib/*.js',
    // Dev aliases the leasing package to its source (see vite.config.ts)
    '../leasing-portal/frontend/src/**/*.{ts,tsx}',
  ],
}
