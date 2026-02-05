# Folder Structure

Based on [Recommended Folder Structure for React 2025](https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc).

```
src/
├── assets/        # Static files (images, fonts, icons)
├── components/    # Shared/reusable UI components
├── config/        # App configuration & environment
├── features/      # Feature-based modules (domain logic)
├── hooks/         # Shared custom hooks
├── layouts/       # View layout components
├── services/      # API calls & external integrations
├── store/         # Global state management
├── styles/        # Global styles & CSS
├── types/         # Shared TypeScript types
├── utils/         # Utility functions
└── views/         # Route-level view components
```

---

## Folder Descriptions

### `/assets`

Static files like images, fonts, and icons.

```
assets/
├── images/
├── fonts/
└── icons/
```

### `/components`

Shared, reusable UI components with no business logic. These can be used anywhere in the app.

```
components/
├── ui/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Dialog.tsx
│   └── DataTable.tsx
└── common/
    ├── ErrorBoundary.tsx
    └── LoadingSpinner.tsx
```

### `/config`

Application configuration, environment variables, and constants.

```
config/
├── env.ts
├── routes.ts
└── constants.ts
```

### `/features`

**The core of the app.** Each feature is a self-contained module with its own components, hooks, types, and constants. Features are organized by domain/functionality.

```
features/
└── [feature-name]/
    ├── components/      # UI specific to this feature
    ├── hooks/           # Hooks specific to this feature
    ├── constants/       # Domain constants
    ├── types/           # Feature-specific types
    └── index.ts         # Public exports
```

**Rules for features:**

- Keep all related code together (components, hooks, constants, types)
- Export only what other parts of the app need via `index.ts`
- Features should not import from other features (use shared code instead)

### `/hooks`

Shared custom hooks that are used across multiple features. Not business-specific.

```
hooks/
├── useDebounce.ts
├── useLocalStorage.ts
├── useMediaQuery.ts
└── useClickOutside.ts
```

### `/layouts`

Layout components that wrap views (headers, sidebars, footers).

```
layouts/
├── MainLayout.tsx
├── AuthLayout.tsx
└── DashboardLayout.tsx
```

### `/services`

API service layer - all external API calls.

```
services/
└── api/
    └── [domain]Service.ts
```

### `/store`

Global state management (Redux, Zustand, etc.).

```
store/
├── index.ts
└── [slice-name]Slice.ts
```

### `/styles`

Global styles, CSS variables, and theme definitions.

```
styles/
├── globals.css
├── variables.css
└── themes/
```

### `/types`

Shared TypeScript types and interfaces used across the app.

```
types/
├── api.ts
├── common.ts
└── index.ts
```

### `/utils`

Pure utility functions with no React dependencies.

```
utils/
├── formatters.ts
├── validators.ts
├── dateUtils.ts
└── stringUtils.ts
```

### `/views`

View-level components, one per route. Views compose features and layouts.

```
views/
├── HomeView.tsx
├── DetailView.tsx
└── NotFoundView.tsx
```

---

## Import Guidelines

1. **Features** should only import from:
   - `components/` (shared UI)
   - `hooks/` (shared hooks)
   - `services/` (API calls)
   - `utils/` (utilities)
   - `types/` (shared types)

2. **Views** compose features and layouts

3. **Components** should be pure UI - no API calls or business logic

4. **Avoid circular dependencies** between features - extract shared code to `components/`, `hooks/`, or `utils/`
