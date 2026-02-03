# Pages

Page-level components, one per route. Pages compose features and layouts.

## Structure

```
pages/
├── HomePage.tsx
├── DetailPage.tsx
└── NotFoundPage.tsx
```

## Guidelines

- One page component per route
- Pages are **compositional** - they import and arrange features and layouts
- Minimal logic - mostly composition and layout
- Route parameters and query handling happens here

## Import Rules

**Can import from:**

- `features/` (this is where pages get their content)
- `layouts/` (page structure)
- `components/` (shared UI)
- `hooks/` (shared hooks)
- `utils/`
- `types/`
- `store/`
- `config/`

**Cannot import from:**

- Other pages

Pages are the **top level** - they can import from almost anywhere.
