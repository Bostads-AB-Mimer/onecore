# Views

View-level components, one per route. Views compose features and layouts.

## How this layer fits in

A view answers the question: **What does the user _see_ on this page?** The full tenant page, wired up with routing and layout. Views are the top layer — they compose widgets and features into complete pages.

## Structure

```
views/
├── HomeView.tsx
├── DetailView.tsx
└── NotFoundView.tsx
```

## Guidelines

- One view component per route
- Views are **compositional** - they import and arrange features and layouts
- Minimal logic - mostly composition and layout
- Route parameters and query handling happens here

## Import Rules

**Can import from:**

- `features/` (this is where views get their content)
- `layouts/` (view structure)
- `components/` (shared UI)
- `hooks/` (shared hooks)
- `utils/`
- `types/`
- `store/`
- `config/`

**Cannot import from:**

- Other views

Views are the **top level** - they can import from almost anywhere.
