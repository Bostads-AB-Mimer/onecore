# Widgets

Compositional layer that combines multiple features into larger, reusable UI blocks.

## How this layer fits in

A widget answers the question: **How do I _compose_ features together?** Put the leases tab, notes tab, and invoices tab into a tabbed layout. Widgets don't add business logic — they arrange features into cohesive UI blocks that views can use.

## Structure

```
widgets/
└── [widget-name]/
    ├── ui/              # Widget UI components
    ├── lib/             # Widget-specific utilities
    ├── types/           # Widget-specific types
    └── index.ts         # Public exports
```

## Guidelines

- Widgets compose features - they don't contain business logic themselves
- Use widgets when multiple features need to work together as a cohesive UI block
- Widgets can be reused across different views
- Keep widgets focused on composition and layout, not domain logic

## Import Rules

**Can import from:**

- `features/`
- `components/` (shared UI)
- `hooks/` (shared hooks)
- `utils/` (utilities)
- `types/` (shared types)
- `config/` (configuration)
- `store/` (global state)

**Cannot import from:**

- Other widgets (avoid widget-to-widget dependencies)
- `views/`
- `layouts/`
