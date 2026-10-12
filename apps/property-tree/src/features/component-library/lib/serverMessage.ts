// Core answers a refused change with { error: '<Swedish reason>' }.
export const serverMessage = (error: unknown): string | undefined => {
  const message = (error as { error?: unknown } | null)?.error
  return typeof message === 'string' ? message : undefined
}
