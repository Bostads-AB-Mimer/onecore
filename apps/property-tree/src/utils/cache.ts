type CacheEntry<T> = {
  data: T
  timestamp: number
}

export class Cache<T> {
  private cache: CacheEntry<T> | null = null
  private updatePromise: Promise<void> | null = null
  private ttl: number

  constructor(ttlMs: number) {
    this.ttl = ttlMs
  }

  async get(fetchFn: () => Promise<T>): Promise<T> {
    const now = Date.now()

    if (!this.cache || now - this.cache.timestamp > this.ttl) {
      if (!this.updatePromise) {
        this.updatePromise = (async () => {
          try {
            const data = await fetchFn()
            this.cache = {
              data,
              timestamp: now,
            }
          } finally {
            this.updatePromise = null
          }
        })()
      }
      await this.updatePromise
    }

    return this.cache!.data
  }

  clear(): void {
    this.cache = null
    this.updatePromise = null
  }
}
