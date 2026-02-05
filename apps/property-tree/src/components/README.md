# Components

Shared, reusable UI components with no business logic.

## Structure

```
components/
├── ui/           # Design system primitives (Button, Card, Dialog)
└── common/       # App-wide components (ErrorBoundary, LoadingSpinner)
```

## Guidelines

- Components here should be **pure UI** - no API calls, no business logic
- They can be used anywhere in the app
- Keep them generic and reusable
- If a component is only used by one feature, it belongs in that feature's folder instead

## Import Rules

**Can import from:**

- `utils/`
- `types/`
- `styles/`

**Cannot import from:**

- `features/`
- `views/`
- `services/`
- `store/`
- `hooks/` (shared hooks that use business logic)
