# Services — Layer 2

API clients and external integrations. The data-access layer of the app.

> **FSD hierarchy:** shared → **services** → entities → features → widgets → pages → app

## Purpose

`services/` provides typed functions for communicating with backend APIs. It handles HTTP requests, response typing, and error mapping. No UI, no React, no business logic — just data in and data out.

## Structure

```
services/
├── api/
│   ├── core/          # Core API client and generated types
│   └── [domain]Service.ts
└── types.ts           # Shared service-level types
```

## Import rules

| Can import from        | Cannot import from                                     |
| ---------------------- | ------------------------------------------------------ |
| `shared/`, `services/` | `entities/`, `features/`, `widgets/`, `pages/`, `app/` |

## Guidelines

- Each service file handles one domain/resource (e.g. `leaseService`, `propertyService`).
- Return typed data and handle errors consistently.
- No React hooks or UI logic — those belong in `entities/` or `features/`.
- Generated API types live in `api/core/generated/` and should not be edited by hand.
