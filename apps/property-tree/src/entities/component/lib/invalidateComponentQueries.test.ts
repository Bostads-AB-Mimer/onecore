import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { QUERY_KEY_ROOTS } from './componentLibraryQueryKeys'
import { invalidateComponentQueries } from './invalidateComponentQueries'

describe('invalidateComponentQueries', () => {
  it('refreshes the space, the pickers and the library list', () => {
    const invalidateQueries = vi.fn()

    invalidateComponentQueries(
      { invalidateQueries } as unknown as QueryClient,
      'SPACE-1'
    )

    expect(invalidateQueries.mock.calls.map(([arg]) => arg.queryKey)).toEqual([
      ['components', 'SPACE-1'],
      ['instances'],
      [QUERY_KEY_ROOTS.instance],
    ])
  })
})
