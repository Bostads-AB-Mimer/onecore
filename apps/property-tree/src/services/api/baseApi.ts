// Base configuration for API calls
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050'

// Simulate network latency for development
const SIMULATED_DELAY = 200

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

// Helper function to simulate API delay
export const simulateDelay = (ms: number = SIMULATED_DELAY) =>
  new Promise((resolve) => setTimeout(resolve, ms))

// Base fetch function with error handling
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // In development, simulate network delay
  if (import.meta.env.DEV) {
    await simulateDelay()
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    mode: 'cors', // Lägg till detta för att hantera CORS
  })

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText)
  }

  return response.json()
}
