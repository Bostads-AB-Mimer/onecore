# Services

API service layer - all external API calls and integrations.

## Structure

```
services/
└── api/
    └── [domain]Service.ts
```

## Guidelines

- Centralize all API calls here
- Each service handles one domain/resource
- Return typed data, handle errors consistently
- Don't put UI logic here - just data fetching/mutation

## Import Rules

**Can import from:**

- `types/`
- `utils/`
- `config/` (API base URLs, etc.)

**Cannot import from:**

- `features/`
- `views/`
- `components/`
- `hooks/`
- `store/`
- `layouts/`

Services are **low-level** - they should only depend on types, utils, and config.
