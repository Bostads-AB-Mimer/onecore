# Config

Application configuration, environment variables, and constants.

## Structure

```
config/
├── env.ts         # Environment variable access
├── routes.ts      # Route path constants
└── constants.ts   # App-wide constants
```

## Guidelines

- Centralize all configuration here
- Never hardcode environment-specific values in components
- Export typed configuration objects

## Import Rules

**Can import from:**
- `types/`

**Cannot import from:**
- Any other folder (config should be self-contained)

This is a **bottom-level** folder - it should have no dependencies on app code.
