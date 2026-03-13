# ONECore — Property Tree

Property management portal for Bostads AB Mimer. Part of the [ONECore](https://github.com/Bostads-AB-Mimer/onecore) monorepo.

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS + Radix UI primitives (via shadcn/ui)
- **Routing:** React Router v6
- **Data fetching:** TanStack React Query
- **Package manager:** pnpm (monorepo)

## Development

### Requirements

- **Node.js** ≥ 20
- **pnpm** ([installation guide](https://pnpm.io/installation))
- **Docker** (for downstream services)

### Setup

```sh
# Create .env from template
pnpm run dev:init

# Install dependencies
pnpm install
```

### Running locally

Requires the downstream API services to be running (ports 5050 and 5010).

```sh
pnpm run dev
```

### Other commands

```sh
pnpm run lint          # Check for lint errors
pnpm run lint:fix      # Auto-fix lint errors (import sorting, etc.)
pnpm run format        # Format with Prettier
pnpm run typecheck     # TypeScript type checking
pnpm run build         # Production build
```

---

## Architecture — Feature-Sliced Design (FSD)

This app follows [Feature-Sliced Design](https://feature-sliced.design/), a layered architecture where each layer has strict import rules enforced by ESLint.

### Layer hierarchy

```
app        ← Layer 7 (topmost)  Routing, providers, layouts
pages      ← Layer 6            One component per route
widgets    ← Layer 5            Compose features into reusable UI blocks
features   ← Layer 4            Business logic and use cases
entities   ← Layer 3            Domain models and basic representations
services   ← Layer 2            API clients and external integrations
shared     ← Layer 1 (lowest)   Generic UI, hooks, utilities, types
```

**Import direction:** layers can only import from layers **below** them, never above. Layers at the same level cannot import from each other (except entities, which can cross-reference).

### Folder structure

```
src/
├── app/               # Router, providers, layout shells
│   ├── router.tsx
│   ├── ProtectedRoute.tsx
│   └── layouts/
├── pages/             # Route-level page components
├── widgets/           # Tabbed layouts, sidebar, composite blocks
├── features/          # Business features (leases, buildings, search…)
├── entities/          # Domain objects (tenant, lease, component…)
├── services/          # API clients and generated types
│   └── api/
├── shared/            # Generic UI, hooks, lib, types, assets
│   ├── ui/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── assets/
├── contexts/          # Legacy (to be migrated)
├── App.tsx            # Root component
└── main.tsx           # Entry point
```

Each layer folder contains its own `README.md` with detailed purpose, structure, and import rules.

### Import rules summary

| Layer        | Can import from                                              | Cannot import from                      |
| ------------ | ------------------------------------------------------------ | --------------------------------------- |
| **shared**   | `shared/`                                                    | everything else                         |
| **services** | `shared/`, `services/`                                       | `entities/` and above                   |
| **entities** | `shared/`, `services/`, other `entities/`                    | `features/` and above                   |
| **features** | `shared/`, `services/`, `entities/`                          | other `features/`, `widgets/` and above |
| **widgets**  | `shared/`, `services/`, `entities/`, `features/`             | other `widgets/`, `pages/` and above    |
| **pages**    | `shared/`, `services/`, `entities/`, `features/`, `widgets/` | other `pages/`, `app/`                  |
| **app**      | everything                                                   | —                                       |

### Enforced by ESLint

These rules are not just documentation — they're **enforced automatically**:

- **`eslint-plugin-boundaries`** — prevents cross-layer violations and enforces barrel imports (`index.ts`) for features, entities, and widgets.
- **`eslint-plugin-simple-import-sort`** — auto-sorts imports by FSD layer on save.
- **`no-restricted-imports`** — forces `@/` alias for cross-layer imports (no relative `../features/…` paths).
- **`eslint-plugin-unicorn`** — enforces filename casing (PascalCase or camelCase for `.tsx`, camelCase for `.ts`).
- **VS Code settings** — ESLint auto-fix on save (committed in `.vscode/settings.json`).
- **CI** — `pnpm lint` runs on every pull request.

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
