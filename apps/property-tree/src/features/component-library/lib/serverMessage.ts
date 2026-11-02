import { ApiError } from '@/services/api/core/apiError'

// Core answers a refused change with 409 and { error: '<Swedish reason>' }; other errors are English.
export const serverMessage = (error: unknown): string | undefined =>
  error instanceof ApiError && error.status === 409 ? error.message : undefined
