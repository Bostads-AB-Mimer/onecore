# App — Layer 7 (topmost)

Application shell: routing, providers, layouts, and global wiring.

> **FSD hierarchy:** shared → services → entities → features → widgets → pages → **app**

## Purpose

`app/` is the entry point that wires everything together. It defines routes, wraps the app in providers, and composes the top-level layout shell (sidebar, header, navigation).

## Structure

```
app/
├── router.tsx             # Route definitions
├── ProtectedRoute.tsx     # Auth guard wrapper
└── layouts/
    ├── AppLayout.tsx      # Root shell: sidebar + navbar + <Outlet />
    ├── AppHeader.tsx      # Top header bar
    ├── DashboardLayout.tsx
    └── RouteDocumentTitle.tsx
```

## Import rules

| Can import from                                                                | Cannot import from       |
| ------------------------------------------------------------------------------ | ------------------------ |
| `shared/`, `services/`, `entities/`, `features/`, `widgets/`, `pages/`, `app/` | — (nothing is above app) |

**Nothing may import from `app/`** except `main.tsx` and `App.tsx`.

## Guidelines

- `app/` defines **structure**, not business logic.
- Layouts compose widgets and features into the application shell — they don’t contain domain logic themselves.
- If a layout has zero business imports (no widgets, features, or entities), consider placing it in `shared/ui` instead.
- Keep the number of layouts small (1–3 is typical).
