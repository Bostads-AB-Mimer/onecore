# Types

Shared TypeScript types and interfaces used across the app.

## Structure

```
types/
├── api.ts       # API response types
├── common.ts    # Common utility types
└── index.ts     # Re-exports
```

## Guidelines

- Only shared types belong here
- Feature-specific types stay in their feature folder
- Keep types well-documented

## Import Rules

**Can import from:**
- Nothing (or other type files only)

**Cannot import from:**
- Any runtime code

Types is a **bottom-level** folder - it has no dependencies.
