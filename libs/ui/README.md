# @onecore/ui

Shared React UI primitives, tailwind preset and base stylesheet for the
ONECore frontends. The components are the shadcn primitives property-tree
uses, moved here unchanged so every app renders the same way.

## Using it in an app

```ts
// tailwind.config.js
import { onecorePreset } from '@onecore/ui/tailwind-preset'

export default {
  presets: [onecorePreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/@onecore/ui/dist/*.js',
  ],
}
```

```ts
// main.tsx, once per app
import '@onecore/ui/styles.css'
```

```tsx
import { Button, Dialog, useToast } from '@onecore/ui'
```

The stylesheet carries the CSS variables and tailwind base layer. It is
tailwind source, with `@tailwind` and `@apply`, not plain CSS: it only works
in an app that runs PostCSS with tailwind and this preset, which is what
emits the utilities for that app's own markup. A package that renders inside
another app (such as the leasing portal pages inside property-tree) must not
import it; the host already has it.

Brand assets are exported as files:

```ts
import logo from '@onecore/ui/assets/onecore_logo_black.svg'
```

Available: `onecore_logo_{black,white,color}.svg` (full wordmark) and
`onecore_simple_{black,white,color}.svg` (mark only).

## What belongs here

Anything domain-free. If it knows about tenants, properties or keys it stays
in the app that owns it. Two layers:

- `src/ui/` primitives: thin styled wrappers over Radix (Button, Dialog, Table).
- `src/components/` composed building blocks with their own interaction
  state, driven entirely by props: a table with selectable cells, a toolbar
  with filters. They take data and callbacks in, never fetch, and know
  nothing about routes.
- `src/hooks/` headless logic the components use, exported so it can be
  reused without the markup.

The one exception to "knows nothing about routes" is `useRouteTab` +
`SegmentedTabs`: tabs are addressed by an optional `:tab?` route segment, so
the hook reads react-router params and the tab bar renders links.

```tsx
// router: path: '/bostader/:rentalId/:tab?'
const TABS = [{ value: 'rum', label: 'Rum' }, { value: 'nycklar', label: 'Nycklar', count: 3 }]
const { value, basePath } = useRouteTab(TABS, 'rum')
<SegmentedTabs tabs={TABS} value={value} basePath={basePath} />
```

The bare page URL renders the default tab. Links keep the query string but
drop `page`, so filters survive a tab switch and pagination resets.

All three export from the package root.

## Scripts

```bash
pnpm build       # tsup → dist (esm + cjs + d.ts + styles.css)
pnpm test        # vitest + testing-library
pnpm typecheck
pnpm lint
```
