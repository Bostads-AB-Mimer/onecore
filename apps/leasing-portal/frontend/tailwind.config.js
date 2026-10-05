import { onecorePreset } from '@onecore/ui/tailwind-preset'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [onecorePreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/@onecore/ui/dist/*.js',
  ],
}
