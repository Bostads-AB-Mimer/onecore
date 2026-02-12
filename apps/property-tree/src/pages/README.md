# Pages — Layer 6

Route-level components. One page per route.

> **FSD hierarchy:** shared → services → entities → features → widgets → **pages** → app

## Purpose

A page answers the question: **“What does the user _see_ at this URL?”**

Pages are the top composition layer — they read route params, wire up the right widgets and features, and pass data down. They contain minimal logic and delegate everything to lower layers.

## Structure

```
pages/
├── BuildingPage.tsx
├── CompanyPage.tsx
├── DashboardPage.tsx
├── FacilityPage.tsx
├── LeasesPage.tsx
├── PropertyPage.tsx
├── ResidencePage.tsx
└── ...
```

## Import rules

| Can import from                                              | Cannot import from     |
| ------------------------------------------------------------ | ---------------------- |
| `shared/`, `services/`, `entities/`, `features/`, `widgets/` | other `pages/`, `app/` |

Pages can import from **all layers below** but cannot import from other pages or from `app/`.

## Guidelines

- One page component per route.
- Handle route params (`useParams`) and query params here.
- Compose widgets and features — don’t implement business logic in the page itself.
- Use named exports (`export const PropertyPage = …`).
- Keep pages thin: extract data fetching into feature hooks, UI composition into widgets.
