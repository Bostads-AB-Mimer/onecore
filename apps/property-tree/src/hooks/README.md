# Hooks

Shared custom hooks used across multiple features. Not business-specific.

## Structure

```
hooks/
├── useDebounce.ts
├── useLocalStorage.ts
├── useMediaQuery.ts
└── useClickOutside.ts
```

## Guidelines

- Only generic, reusable hooks belong here
- Business-specific hooks belong in their feature folder
- Keep hooks focused on a single responsibility

## Import Rules

**Can import from:**
- `utils/`
- `types/`
- `config/`

**Cannot import from:**
- `features/`
- `pages/`
- `services/` (hooks here should not make API calls directly)
- `store/` (global state hooks go in store folder)
- `components/`
