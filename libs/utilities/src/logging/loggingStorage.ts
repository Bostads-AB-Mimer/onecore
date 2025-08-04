import { AsyncLocalStorage } from 'async_hooks'

export const storage = new AsyncLocalStorage()

export const getCorrelationId = (): string | undefined | null => {
  const store = storage.getStore()

  if (store) {
    const correlationId = (store as { correlationId: string }).correlationId

    return correlationId
  } else {
    return undefined
  }
}
