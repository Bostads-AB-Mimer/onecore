# Utils

Pure utility functions with no React dependencies.

## Structure

```
utils/
├── formatters.ts   # Data formatting (dates, numbers, strings)
├── validators.ts   # Validation helpers
├── dateUtils.ts    # Date manipulation
└── stringUtils.ts  # String helpers
```

## Guidelines

- Pure functions only - no side effects
- No React imports (those go in `hooks/`)
- Well-tested, reusable across the app
- If a utility is feature-specific, keep it in that feature

## Import Rules

**Can import from:**

- `types/`
- `config/` (for constants needed in utils)

**Cannot import from:**

- Any other folder

Utils is a **bottom-level** folder - it should have minimal dependencies.
