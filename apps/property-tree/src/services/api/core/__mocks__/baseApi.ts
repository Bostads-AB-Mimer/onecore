import { vi } from 'vitest'

// Used by `vi.mock('.../baseApi')` in tests. The real baseApi reads the app
// environment at import, which is not available in unit tests.

export const GET = vi.fn()
export const POST = vi.fn()
export const PUT = vi.fn()
export const DELETE = vi.fn()
export const PATCH = vi.fn()

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
