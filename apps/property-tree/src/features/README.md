# Features — Layer 4

User-facing use cases and business logic built on top of entities.

> **FSD hierarchy:** shared → services → entities → **features** → widgets → pages → app

## Purpose

A feature answers the question: **“What can I _do_ with tenants / leases / buildings?”**

Search for them, filter a list, manage a component library, run an inspection. Features use entities for domain knowledge and add business logic, mutations, and interactive UI on top.

## Structure

```
features/
└── [feature-name]/
    ├── ui/          # Feature-specific UI components
    ├── hooks/       # Feature-specific hooks (filters, mutations, workflows)
    ├── lib/         # Feature-specific utilities
    ├── constants/   # Domain constants
    ├── types/       # Feature-specific types
    └── index.ts     # Public barrel exports
```

Current features: `auth`, `buildings`, `companies`, `component-library`, `documents`, `facilities`, `inspections`, `leases`, `maintenance-units`, `parking-spaces`, `properties`, `rental-blocks`, `residences`, `rooms`, `search`, `tenants`, `work-orders`

## Import rules

| Can import from                     | Cannot import from                              |
| ----------------------------------- | ----------------------------------------------- |
| `shared/`, `services/`, `entities/` | other `features/`, `widgets/`, `pages/`, `app/` |

⚠️ **Features cannot import from other features.** If two features need shared logic, extract it into `entities/` or `shared/`.

## Guidelines

- Keep each feature self-contained and independent.
- This is where most business logic lives: filters, search, CRUD workflows, export, mutations.
- Export only what other layers need via `index.ts` (barrel imports are enforced by ESLint).
- Feature-specific components stay here — don’t put them in `shared/ui`.
