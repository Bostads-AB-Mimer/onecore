# Store

Global state management (Redux, Zustand, etc.).

## Structure

```
store/
├── index.ts              # Store setup and exports
└── [slice-name]Slice.ts  # Individual state slices
```

## Guidelines

- Only truly global state belongs here (user, auth, theme, etc.)
- Feature-local state should stay in the feature
- Keep slices focused and minimal

## Import Rules

**Can import from:**

- `types/`
- `utils/`
- `config/`
- `services/` (for async thunks/actions that fetch data)

**Cannot import from:**

- `features/`
- `views/`
- `components/`
- `hooks/`
- `layouts/`
