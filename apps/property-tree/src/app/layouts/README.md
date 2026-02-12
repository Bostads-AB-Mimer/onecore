# Layouts (`app/layouts`)

App-level layout compositions that wire together widgets, features, and shared UI
into the shell structure used by the router.

> **Why `app/layouts`?**
> FSD has no dedicated "layouts" layer. The official guide
> ([Page layouts](https://feature-sliced.design/docs/guides/examples/page-layout))
> recommends two homes for layouts:
>
> 1. **`shared/ui`** — for simple, stateless layout primitives (e.g. a grid
>    wrapper or a generic page shell with header/content/footer slots).
> 2. **`app/layouts`** — for layouts that **compose widgets or features**
>    (e.g. a layout that renders a sidebar navigation widget and a top-bar
>    with search). Because `app` sits at the top of the layer hierarchy it
>    may import from every layer below.
>
> The files in this folder fall in category 2: they compose widgets and
> features into the application shell.

## Structure

```
app/layouts/
├── AppLayout.tsx        # Root shell: sidebar + navbar + <Outlet />
├── RouteDocumentTitle.tsx         # Sets document.title from route handle metadata
├── ObjectPageLayout.tsx  # Loading / error / not-found wrapper (candidate for shared/ui)
├── ObjectPageTabs.tsx    # Tabbed content area for object pages (candidate for shared/ui)
└── README.md
```

### Notes on placement

| File                     | Could live in `shared/ui`? | Rationale for current placement                                                            |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| `AppLayout.tsx`          | ❌                         | Composes `widgets/navigation`, `features/search`, `shared/ui/Sidebar`. Must stay in `app`. |
| `RouteDocumentTitle.tsx` | ❌                         | Uses `useMatches()` from the router to read route handles — an app-level concern.          |
| `ObjectPageLayout.tsx`   | ✅                         | Stateless, no business imports. Can be moved to `shared/ui` when convenient.               |
| `ObjectPageTabs.tsx`     | ✅                         | Stateless, no business imports. Can be moved to `shared/ui` when convenient.               |

## Import rules (FSD layer hierarchy)

`app` is the **topmost** layer, so files here may import from **all** layers:

```
app  ← you are here
└── can import from:
    ├── widgets/
    ├── features/
    ├── entities/
    └── shared/
```

**Nothing may import from `app`** except the application entrypoint (`main.tsx`)
and the router configuration (`App.tsx`).

## Guidelines

- Layouts define page **structure** (header, sidebar, content area) — not
  business logic. Business logic belongs in the widgets and features they
  compose.
- Pass dynamic content via `<Outlet />`, `children`, render-props, or slots
  rather than hard-coding page-specific content.
- If a layout has **zero business imports** (no widgets, features, or
  entities), prefer placing it in `shared/ui` instead.
- Keep the number of layouts small. Most apps need only 1–3 (e.g. an
  authenticated shell, a public/marketing shell, and possibly a
  full-screen/modal shell).

## References

- [FSD — Page layouts guide](https://feature-sliced.design/docs/guides/examples/page-layout)
- [FSD — Layers reference](https://feature-sliced.design/docs/reference/layers)
- [FSD — App layer definition](https://feature-sliced.design/docs/reference/layers#app)
