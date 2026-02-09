# Entities

Core business domain objects. Each entity represents a fundamental "thing" in the domain and provides reusable data logic and basic UI representations.

## How this layer fits in

An entity answers the question: **What _is_ a tenant?** A name, a personal number, contact info. Here's how to format and display that. Entities hold pure domain knowledge — no business workflows, no user actions. Features build on top of entities to create use cases.

## Structure

```
entities/
└── [entity-name]/
    ├── ui/              # Basic UI representations of the entity
    ├── lib/             # Formatting, sorting, status helpers, constants
    └── index.ts         # Public exports
```

## Guidelines

- Entities define **what something is**, not what you can do with it (that belongs in `features/`)
- Keep entities focused on domain knowledge: data formatting, status logic, sorting, and simple display components
- Entities should be reusable across multiple features
- Export only what other parts of the app need via `index.ts`

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

- `features/`
- `widgets/`
- `views/`
- `layouts/`
- Other entities (keep entities independent)
