# Shared — Layer 1 (lowest)

Cross-cutting, reusable building blocks with **no domain knowledge**.

> **FSD hierarchy:** shared → services → entities → features → widgets → pages → app

## Purpose

Everything in `shared/` is generic and knows nothing about tenants, leases, buildings, or any other domain concept. If it could be copy-pasted into a completely different app and still make sense, it belongs here.

## Structure

```
shared/
├── ui/          # Generic UI components (Button, Card, Dialog, Table, filters, layout shells…)
├── hooks/       # Generic hooks (useMediaQuery, useUrlFilters, useDebounce…)
├── lib/         # Pure utility functions (formatters, validators, date helpers…)
├── types/       # Shared TypeScript types
└── assets/      # Static assets (images, icons, fonts)
```

## Import rules

| Can import from | Cannot import from                                                  |
| --------------- | ------------------------------------------------------------------- |
| `shared/`       | `services/`, `entities/`, `features/`, `widgets/`, `pages/`, `app/` |

`shared/` is the bottom of the hierarchy — nothing outside this folder should be a dependency.

## Guidelines

- **No domain logic.** If a component, hook, or utility references a specific entity or feature, it belongs higher up.
- **No API calls.** Data fetching belongs in `services/` or higher layers.
- **Keep it reusable.** Every export should be usable by any layer above.
- Barrel exports (`index.ts`) are **not** required for `shared/` — direct imports like `@/shared/ui/Button` are allowed.
