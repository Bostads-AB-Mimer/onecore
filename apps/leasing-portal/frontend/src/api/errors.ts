/** A BFF response outside 2xx, kept with its status so pages can word the error. */
export class BffRequestError extends Error {
  constructor(public readonly status: number) {
    super(`BFF request failed with status ${status}`)
    this.name = 'BffRequestError'
  }
}

/** Thrown before any request when the host has no BFF URL configured. */
export class BffNotConfiguredError extends Error {
  constructor() {
    super('Leasing BFF URL is not configured')
    this.name = 'BffNotConfiguredError'
  }
}

export const describeBffError = (error: unknown): string => {
  if (error instanceof BffNotConfiguredError) {
    return 'Uthyrningstjänsten är inte konfigurerad för den här miljön.'
  }
  if (error instanceof BffRequestError) {
    if (error.status === 401) return 'Sessionen har gått ut. Loggar in igen...'
    if (error.status === 403) return 'Du saknar behörighet till uthyrning.'
  }
  return 'Kunde inte nå uthyrningstjänsten.'
}
