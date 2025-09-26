import { defineConfig } from 'eslint/config'

import onecoreReactBase from '../../eslint.react.config.mjs'

export default defineConfig([
  onecoreReactBase,
  {
    rules: {
      'react/prop-types': 'off',
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          groups: [
            ['external', 'builtin'],
            'internal',
            ['index', 'sibling', 'parent'],
          ],
        },
      ],
    },
  },
])
