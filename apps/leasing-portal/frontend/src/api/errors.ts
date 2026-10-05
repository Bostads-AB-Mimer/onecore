/** A BFF response outside 2xx, kept with its status so pages can word the error. */
export class BffRequestError extends Error {
  constructor(public readonly status: number) {
    super(`BFF request failed with status ${status}`)
    this.name = 'BffRequestError'
  }
}

export const describeBffError = (error: unknown): string => {
  if (error instanceof BffRequestError) {
    if (error.status === 401) return 'Sessionen har gått ut. Loggar in igen...'
    if (error.status === 403) return 'Du saknar behörighet till uthyrning.'
  }
  return 'Kunde inte nå uthyrningstjänsten.'
}
