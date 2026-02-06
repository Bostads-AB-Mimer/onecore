# Features

**The core of the app.** Each feature is a self-contained module organized by domain/functionality.

## How this layer fits in

A feature answers the question: **What can I _do_ with tenants?** Search for them, list their leases, add comments. Features use entities for domain knowledge and add business logic and user-facing workflows on top.

## Structure

```
features/
└── [feature-name]/
    ├── components/      # UI specific to this feature
    ├── hooks/           # Hooks specific to this feature
    ├── lib/             # Utility functions specific to this feature
    ├── constants/       # Domain constants
    ├── types/           # Feature-specific types
    └── index.ts         # Public exports
```

## Guidelines

- Keep all related code together (components, hooks, constants, types)
- Export only what other parts of the app need via `index.ts`
- Each feature should be as independent as possible
- Feature-specific components stay here, not in `/components`

## Import Rules

**Can import from:**

- `components/` (shared UI)
- `hooks/` (shared hooks)
- `services/` (API calls)
- `utils/` (utilities)
- `types/` (shared types)
- `config/` (configuration)
- `store/` (global state)

**Cannot import from:**

- Other features (this is critical - extract shared code instead)
- `views/`
- `layouts/`
