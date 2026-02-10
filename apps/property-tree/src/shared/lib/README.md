# Lib

Pure utility functions with no React dependencies.

## Location / Structure

```
shared/lib/
├── formatters.ts   # Data formatting (dates, numbers, strings)
├── validators.ts   # Validation helpers
├── dateUtils.ts    # Date manipulation
└── stringUtils.ts  # String helpers
```

## Guidelines

- Pure functions only - no side effects
- No React imports (those go in `hooks/`)
- Well-tested, reusable across the app
- If a lib is feature-specific, keep it in that feature

## Import Rules

**Can import from:**

- `shared/types` (for shared type definitions)
- `config/` (for constants needed in utils)

**Cannot import from:**

- Any other folder

`shared/lib` is a **bottom-level** folder - it should have minimal dependencies and no React.
