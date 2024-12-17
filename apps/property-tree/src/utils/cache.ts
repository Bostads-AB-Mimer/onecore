interface CacheEntry<T> {
  data: T
  timestamp: number
}

interface CacheOptions {
  ttl: number
  maxEntries?: number
}

export class Cache<K, T> {
  private cache: Map<K, CacheEntry<T>> = new Map()
  private updatePromises: Map<K, Promise<void>> = new Map()
  private options: CacheOptions

  constructor(options: CacheOptions) {
    this.options = options
  }

  async get(key: K, fetchFn: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const entry = this.cache.get(key)

    if (!entry || now - entry.timestamp > this.options.ttl) {
      let updatePromise = this.updatePromises.get(key)
      
      if (!updatePromise) {
        updatePromise = (async () => {
          try {
            const data = await fetchFn()
            this.cache.set(key, { data, timestamp: now })
            
            // Enforce max entries limit if set
            if (this.options.maxEntries && this.cache.size > this.options.maxEntries) {
              const oldestKey = Array.from(this.cache.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0]
              this.cache.delete(oldestKey)
            }
          } finally {
            this.updatePromises.delete(key)
          }
        })()
        
        this.updatePromises.set(key, updatePromise)
      }
      
      await updatePromise
    }

    return this.cache.get(key)!.data
  }

  clear(key?: K): void {
    if (key) {
      this.cache.delete(key)
      this.updatePromises.delete(key)
    } else {
      this.cache.clear()
      this.updatePromises.clear()
    }
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }
}
