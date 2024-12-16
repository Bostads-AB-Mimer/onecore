// Base configuration for API calls
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050'

// Common headers for API requests
const defaultHeaders = {
  'Content-Type': 'application/json',
}

// Generic API error class
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Base fetch function with error handling
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText)
  }

  return response.json()
}
