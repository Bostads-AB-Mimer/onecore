import { defineConfig } from 'eslint/config'
import globals from 'globals'

import onecoreBase from '../../eslint.config.mjs'

export default defineConfig([
  onecoreBase,
  // Theme scripts run in the browser on Keycloak's login pages, not in Node
  {
    files: ['theme/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: globals.browser,
    },
  },
])
