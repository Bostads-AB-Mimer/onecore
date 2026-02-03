# Layouts

Layout components that wrap pages (headers, sidebars, footers).

## Structure

```
layouts/
├── MainLayout.tsx
├── AuthLayout.tsx
└── DashboardLayout.tsx
```

## Guidelines

- Layouts define the page structure (header, sidebar, content area, footer)
- They receive children (the page content) as props
- Keep layouts generic - they shouldn't contain business logic

## Import Rules

**Can import from:**
- `components/` (shared UI)
- `hooks/` (shared hooks)
- `utils/`
- `types/`
- `styles/`
- `store/` (for user/auth state needed in header, etc.)

**Cannot import from:**
- `features/`
- `pages/`
- `services/`
