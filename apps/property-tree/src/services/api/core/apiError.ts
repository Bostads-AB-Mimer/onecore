// No side effects: unlike baseApi, importing this does not build the API
// client, so pure code and tests can use ApiError without a browser.
import type { ListFailure } from '@/shared/ui/ListQueryState'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** The error code from the response body (e.g. 'cache-warming'), when it had one. */
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Core answers 503 cache-warming while leasing loads its cache for the first time. */
export const isCacheWarmingError = (error: unknown) =>
  error instanceof ApiError &&
  error.status === 503 &&
  error.code === 'cache-warming'

/** How ListQueryState should describe a failed list request. */
export const listFailure = (error: unknown): ListFailure =>
  error instanceof ApiError && error.status === 403
    ? 'forbidden'
    : isCacheWarmingError(error)
      ? 'warming'
      : 'failed'

/** React Query retry options for a list that can be cache-warming: only that
 * is worth waiting for, and core's Retry-After is 30 s. */
export const cacheWarmingRetry = {
  retry: (failureCount: number, error: unknown) =>
    isCacheWarmingError(error) && failureCount < 3,
  retryDelay: () => 30_000,
}
