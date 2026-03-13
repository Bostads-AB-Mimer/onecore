# Entities — Layer 3

Core domain objects and their basic representations.

> **FSD hierarchy:** shared → services → **entities** → features → widgets → pages → app

## Purpose

An entity answers the question: **“What _is_ a tenant / lease / component?”**

Entities encapsulate pure domain knowledge — how to format, display, and reason about a domain object. They do **not** contain user-facing workflows or business actions (that belongs in `features/`).

## Structure

```
entities/
└── [entity-name]/
    ├── ui/          # Basic UI representations of the entity
    ├── hooks/       # React Query wrappers around services for this entity
    ├── lib/         # Formatting, sorting, status helpers, constants
    ├── types/       # Entity-specific types (when not covered by services)
    └── index.ts     # Public barrel exports
```

Current entities: `component`, `document`, `lease`, `tenant`, `user`

## Import rules

| Can import from                           | Cannot import from                        |
| ----------------------------------------- | ----------------------------------------- |
| `shared/`, `services/`, other `entities/` | `features/`, `widgets/`, `pages/`, `app/` |

Entities **can** import from other entities when it makes domain sense (e.g. `component` using `document` helpers), but avoid deep coupling or circular dependencies.

## Guidelines

- **Define what something _is_**, not what you can _do_ with it.
- `hooks/` should wrap `services/` calls with React Query — no business workflows or mutations that represent user actions.
- `ui/` should be basic, reusable display components — complex interactive workflows belong in `features/`.
- Export only what other layers need via `index.ts` (barrel imports are enforced by ESLint).
- Entities should be reusable across multiple features.
