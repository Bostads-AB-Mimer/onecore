# Frontend Layer Patterns

## Reference files to read before generating

Read these files from the codebase to confirm current patterns:

**keys-portal:**
- `apps/keys-portal/src/services/api/core/base-api.ts` — openapi-fetch client
- `apps/keys-portal/src/services/api/keyService.ts` — service adapter pattern
- `apps/keys-portal/src/services/types.ts` — type re-exports
- `apps/keys-portal/src/hooks/useKeyLoans.ts` — manual state hook pattern

**property-tree:**
- `apps/property-tree/src/services/api/core/baseApi.ts` — openapi-fetch client
- `apps/property-tree/src/services/api/core/componentService.ts` — service adapter
- `apps/property-tree/src/services/types.ts` — type re-exports
- `apps/property-tree/src/entities/component/hooks/useComponents.ts` — React Query hook

## File structure

The structure depends on which app you're targeting:

**keys-portal (flat hooks):**
```
apps/keys-portal/src/
├── services/
│   ├── api/
│   │   └── {resource}Service.ts    # NEW: service adapter
│   └── types.ts                    # MODIFY: add type re-exports
└── hooks/
    └── use{Resource}s.ts           # NEW: data-fetching hook
```

**property-tree (entity-based):**
```
apps/property-tree/src/
├── services/
│   ├── api/core/
│   │   └── {resource}Service.ts    # NEW: service adapter
│   └── types.ts                    # MODIFY: add type re-exports
└── entities/{resource}/
    └── hooks/
        └── use{Resource}s.ts       # NEW: data-fetching hook
```

## Service adapter pattern

Both apps use the same core pattern — import HTTP methods from the base API client and call endpoints:

```typescript
import type { {Resource}, PaginatedResponse } from '@/services/types'
import { GET, POST, PUT, DELETE } from './core/base-api'

export const {resource}Service = {
  async getAll(
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<{Resource}>> {
    const { data, error } = await GET('/{resource}s', {
      params: { query: { page, limit } },
    })
    if (error) throw error
    return data as PaginatedResponse<{Resource}>
  },

  async getById(id: string): Promise<{Resource}> {
    const { data, error } = await GET('/{resource}s/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
    return data?.content as {Resource}
  },

  async create(payload: Create{Resource}Request): Promise<{Resource}> {
    const { data, error } = await POST('/{resource}s', {
      body: payload as any,
    })
    if (error) throw error
    if (!data?.content) throw new Error('Failed to create {resource}')
    return data.content as {Resource}
  },

  async update(id: string, payload: Update{Resource}Request): Promise<{Resource}> {
    const { data, error } = await PUT('/{resource}s/{id}', {
      params: { path: { id } },
      body: payload as any,
    })
    if (error) throw error
    return data?.content as {Resource}
  },

  async remove(id: string): Promise<void> {
    const { error } = await DELETE('/{resource}s/{id}', {
      params: { path: { id } },
    })
    if (error) throw error
  },
}
```

## Type re-exports

Add to `apps/{app}/src/services/types.ts`:

```typescript
// Extract from generated Core API types
export type {Resource} = components['schemas']['{Resource}']
export type Create{Resource}Request = components['schemas']['Create{Resource}Request']
export type Update{Resource}Request = components['schemas']['Update{Resource}Request']
```

## Hook patterns

### keys-portal pattern (manual state)

keys-portal uses manual `useState` + `useCallback` + `useEffect`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { {Resource}, PaginatedResponse } from '@/services/types'
import { {resource}Service } from '@/services/api/{resource}Service'

export interface Use{Resource}sResult {
  {resource}s: {Resource}[]
  loading: boolean
  refresh: () => Promise<void>
}

export function use{Resource}s(
  page: number = 1,
  limit: number = 20,
  enabled = true
): Use{Resource}sResult {
  const [{resource}s, set{Resource}s] = useState<{Resource}[]>([])
  const [loading, setLoading] = useState(false)

  const fetch{Resource}s = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    try {
      const result = await {resource}Service.getAll(page, limit)
      set{Resource}s(result.content)
    } catch (err) {
      console.error('Failed to fetch {resource}s:', err)
    } finally {
      setLoading(false)
    }
  }, [page, limit, enabled])

  useEffect(() => {
    fetch{Resource}s()
  }, [fetch{Resource}s])

  return { {resource}s, loading, refresh: fetch{Resource}s }
}
```

### property-tree pattern (React Query)

property-tree uses `@tanstack/react-query`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { {resource}Service } from '@/services/api/core/{resource}Service'

export function use{Resource}s(parentId?: string) {
  const query = useQuery({
    queryKey: ['{resource}s', parentId],
    queryFn: () => {resource}Service.getAll(),
    enabled: !!parentId,
  })

  return {
    {resource}s: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}
```

For mutations:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { {resource}Service } from '@/services/api/core/{resource}Service'

export function useCreate{Resource}() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: Create{Resource}Request) =>
      {resource}Service.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['{resource}s'] })
    },
  })
}
```

## Important: which pattern to use

- Check the target app's existing hooks to determine which pattern it uses
- **keys-portal** currently uses manual state management (useState + useCallback)
- **property-tree** uses React Query
- Always match the existing app's convention — don't introduce React Query into an app that doesn't use it

## Type generation

After the service Swagger is live, regenerate types:

```bash
# In the frontend app directory
pnpm run generate-api-types       # Service types
pnpm run generate-api-types:core  # Core API types
```

The generated types land in `src/services/api/generated/api-types.ts` and `src/services/api/core/generated/api-types.ts`. These are the source of truth for `components['schemas']` types.
