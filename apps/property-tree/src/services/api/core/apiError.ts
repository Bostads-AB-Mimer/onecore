export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Keeps the HTTP status of a failed call; the message is core's `error` text when it sends one.
export const toApiError = (error: unknown, response: Response): ApiError => {
  const message = (error as { error?: unknown } | null)?.error
  return new ApiError(
    response.status,
    typeof message === 'string'
      ? message
      : `Request failed (status ${response.status})`
  )
}
