---
name: cross-service-checklist
description: >
  Use when making changes that touch 2+ packages (top-level directories:
  services/*, core, apps/*, libs/*) in the monorepo — e.g., changing a service
  AND its consumers, modifying shared libraries, or editing types/schemas that
  flow across service boundaries. Also use when changing a shared library even
  if you only edit one package, since consumers will be affected.
---

# Cross-Service Change Checklist

When a change crosses package boundaries in this monorepo, follow this checklist to avoid regressions.

## Before Editing

### 1. Identify the blast radius

List which packages will be affected by this change. Show the user:

> "This change touches **X**, which is consumed by **Y** and **Z**."

Use this dependency map as a starting point:

| Package          | Consumed by                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `libs/types`     | All services, core, all apps                                     |
| `libs/utilities` | All services, core, all apps                                     |
| `services/*`     | `core` (via adapters), sometimes `apps/*` (via generated types)  |
| `core`           | `apps/property-tree`, `apps/keys-portal`, `apps/internal-portal` |

### 2. Trace dependencies

- **For type/schema changes:** Use the `type-pipeline` skill. It covers the full Zod -> Swagger -> codegen flow.
- **For logic changes:** Identify callers and consumers. Search for imports of the function/module you're changing across the monorepo.
- **For database/SQL changes:** Identify all queries that touch the affected tables.

## While Editing

### 3. Rules for specific change types

- **Shared library changes (`libs/*`):** After modifying, run `pnpm run build:libs` before testing any consumer. Consumers depend on built output, not source.
- **SQL query changes:** Show the before/after query side by side and explain what changed.

### 4. When unsure about scope

Ask the user rather than guessing. Say:

> "I'm not sure if this change also affects **X**. Should I check?"

Guessing wrong here causes the regressions we're trying to prevent.

## After Editing

### 5. Verify with typecheck

Run `pnpm run typecheck` after completing the changes. The monorepo has zero type errors — any new errors mean something broke.

If you modified `libs/*`, make sure you ran `pnpm run build:libs` first (step 3), otherwise typecheck will report false errors.

### 6. Check imports across boundaries

Verify that all cross-package imports resolve. Common failure modes:

- Importing from source (`libs/types/src/...`) instead of the package (`@onecore/types`)
- Importing a symbol that was renamed or removed in the change
- Missing re-export from a barrel file (`index.ts`)

### 7. Regression check

Explicitly state what you verified:

> "I changed **X**. Confirming **Y** and **Z** still work because [reason]."

This is not optional. Every cross-service change gets an explicit regression statement.
