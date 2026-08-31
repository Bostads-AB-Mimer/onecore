# Widgets — Layer 5

Compositional layer that combines multiple features into larger, reusable UI blocks.

> **FSD hierarchy:** shared → services → entities → features → **widgets** → pages → app

## Purpose

A widget answers the question: **“How do I _compose_ features together?”**

Put the leases tab, notes tab, and component tab into a tabbed layout. Widgets don’t add business logic — they arrange features and entities into cohesive UI blocks that pages can drop in.

## Structure

```
widgets/
└── [widget-name]/
    ├── ui/          # Widget UI components
    └── index.ts     # Public barrel exports
```

Current widgets: `building-tabs`, `facility-tabs`, `maintenance-unit-tabs`, `parking-space-tabs`, `property-tabs`, `residence-tabs`, `sidebar`, `tenant-tabs`

## Import rules

| Can import from                                  | Cannot import from                 |
| ------------------------------------------------ | ---------------------------------- |
| `shared/`, `services/`, `entities/`, `features/` | other `widgets/`, `pages/`, `app/` |

⚠️ **Widgets cannot import from other widgets.** If two widgets need shared logic, extract it into `features/` or `shared/`.

## Guidelines

- Widgets are **compositional** — they arrange features, they don’t implement business logic.
- Use widgets when multiple features need to work together as a cohesive UI block (e.g. a tabbed object page).
- Widgets can be reused across different pages.
- Export via `index.ts` (barrel imports are enforced by ESLint).
