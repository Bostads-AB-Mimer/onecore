import { defineConfig } from 'eslint/config'
import globals from 'globals'

import onecoreBase from '../../eslint.config.mjs'

export default defineConfig([
  onecoreBase,
  // src/ is bundled into a script for Keycloak's login pages, so it runs in the browser
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
