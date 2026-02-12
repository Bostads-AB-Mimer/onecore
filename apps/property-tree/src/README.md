# Folder Structure (FSD)

This app follows a **Feature-Sliced Design** (FSD)-inspired structure.

```
src/
├── app/         # App shell: routing, providers, entry wiring
├── shared/      # Reusable, cross-cutting building blocks
├── entities/    # Domain models and basic representations
├── features/    # User-facing use cases built on entities
├── widgets/     # Reusable compositions of features/entities
├── views/       # Route-level pages (aka pages in FSD)
├── layouts/     # Page layouts (shells around views)
└── services/    # API and external integrations
```

High-level dependency direction:

```text
app → views → widgets → features → entities → shared
                      ↘ services (data access)
```

Lower layers must **never** depend on upper layers (for example, `entities/` must not import from `features/` or `views/`).

---

## Folder Descriptions

### `/shared`

Cross-cutting, reusable primitives with **no domain knowledge**:

- `shared/ui` – generic UI components (buttons, cards, dialogs, icons)
- `shared/hooks` – generic hooks (media queries, responsive checks, etc.)
- `shared/lib` – pure utility functions
- `shared/types` – shared TypeScript types
- `shared/assets` – static assets

Anything that knows nothing about “tenant”, “component”, etc. belongs here.

### `/entities`

Domain objects and their basic behavior. Each entity (`tenant`, `component`, `document`, …):

- Encapsulates domain-specific logic (formatting, status, basic calculations)
- Provides small UI pieces for rendering the entity
- May include hooks that fetch data for a single entity or collection

Entities can depend on `shared/*` and `services/`, and on other entities when it makes domain sense, but must never import from `features/`, `widgets/`, or `views/`.

### `/features`

Use cases / user stories built on top of entities, for example "manage component library" or "search tenants". A feature may include:

- Feature-specific UI
- Feature-specific hooks and lib
- Coordination of multiple entities and services

Features can depend on `entities/`, `shared/`, and `services/`, but not on other features (extract shared code instead).

### `/widgets`

Reusable compositions that glue together features and entities into a cohesive block (for example a tabbed object page). Widgets are used by `views/` and should not contain low-level business logic.

### `/views`

Route-level pages. Views:

- Handle routing params / query params
- Choose layouts and widgets/features to render
- Contain minimal domain logic (delegate downwards).

### `/layouts`

Layout components wrapping views (headers, sidebars, navigation). Layouts should be generic and mostly depend on `shared/*` and global app state.

### `/services`

Low-level API clients and integrations. Services expose typed methods used by entities and features for data access.

---

## Import Guidelines (Summary)

- `shared/*` – bottom layer; no imports from app-specific layers.
- `entities/*` – can import from `shared/*` and `services/` (and other entities when reasonable).
- `features/*` – can import from `entities/*`, `shared/*`, and `services/`, but not from other features.
- `widgets/*` – can import from `features/*`, `entities/*`, and `shared/*`.
- `views/*` – can import from anything below (`widgets/`, `features/`, `entities/`, `shared/`, `services/`, `layouts/`).

2. **Views** compose features and layouts

3. **Components** should be pure UI - no API calls or business logic

4. **Avoid circular dependencies** between features - extract shared code to `components/`, `hooks/`, or `utils/`
