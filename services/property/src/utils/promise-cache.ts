// TTL'd promise caches shared by the adapters. The promise is cached rather
// than the value so concurrent callers share one in-flight fetch, and
// failures evict themselves so the next caller retries — but only while they
// are still the current entry: a slow failure settling after a refresh must
// not evict the newer entry that replaced it.

interface Entry<T> {
  promise: Promise<T>
  expiresAt: number
}

export interface CachedPromise<T> {
  get(): Promise<T>
  clear(): void
}

/** A single cached value, refetched when older than ttlMs. */
export const cachedPromise = <T>(
  ttlMs: number,
  fetch: () => Promise<T>
): CachedPromise<T> => {
  let cache: Entry<T> | undefined

  return {
    get() {
      const now = Date.now()
      if (!cache || cache.expiresAt <= now) {
        const entry: Entry<T> = { promise: fetch(), expiresAt: now + ttlMs }
        entry.promise.catch(() => {
          if (cache === entry) cache = undefined
        })
        cache = entry
      }
      return cache.promise
    },
    clear() {
      cache = undefined
    },
  }
}

export interface CachedKeyed<T> {
  get(key: string): Promise<T>
  clear(): void
}

/** One cached value per key, each refetched when older than ttlMs. Expired
 * entries are swept on refresh — keys may come from client input. */
export const cachedKeyed = <T>(
  ttlMs: number,
  fetch: (key: string) => Promise<T>
): CachedKeyed<T> => {
  const cache = new Map<string, Entry<T>>()

  return {
    get(key) {
      const now = Date.now()
      const hit = cache.get(key)
      if (hit && hit.expiresAt > now) return hit.promise

      for (const [k, entry] of cache) {
        if (entry.expiresAt <= now) cache.delete(k)
      }

      const entry: Entry<T> = { promise: fetch(key), expiresAt: now + ttlMs }
      entry.promise.catch(() => {
        if (cache.get(key) === entry) cache.delete(key)
      })
      cache.set(key, entry)
      return entry.promise
    },
    clear() {
      cache.clear()
    },
  }
}

export interface CachedBatch<V> {
  /** Start a refresh for any missing or stale key without awaiting it. */
  prime(uniqueKeys: string[]): void
  /** The value per key, in the given order, fetching where needed. */
  get(uniqueKeys: string[]): Promise<V[]>
  clear(): void
}

/**
 * A per-key cache filled by batch fetches. If ANY requested key is missing or
 * stale, the WHOLE requested set is refetched in one round and given a common
 * new expiry — see buildPropertySubtrees for why. Keys the batch does not
 * return resolve to fallback(key). Callers pass keys already deduplicated.
 */
export const cachedBatch = <V>(
  ttlMs: number,
  fetchBatch: (keys: string[]) => Promise<Map<string, V>>,
  fallback: (key: string) => V
): CachedBatch<V> => {
  const cache = new Map<string, Entry<V>>()

  const prime = (uniqueKeys: string[]): void => {
    const now = Date.now()
    const needsRefresh = uniqueKeys.some((key) => {
      const hit = cache.get(key)
      return !hit || hit.expiresAt <= now
    })
    if (!needsRefresh) return

    // Sweep on refresh: without this the map keeps one entry per key ever
    // requested. Deleting an expired entry doesn't cancel anything — a caller
    // already holding its promise still gets it.
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key)
    }

    const batch = fetchBatch(uniqueKeys)
    batch.catch(() => undefined)

    const expiresAt = now + ttlMs
    for (const key of uniqueKeys) {
      const entry: Entry<V> = {
        promise: batch.then(
          (values) => values.get(key) ?? fallback(key),
          (err) => {
            if (cache.get(key) === entry) cache.delete(key)
            throw err
          }
        ),
        expiresAt,
      }
      // Not every caller awaits every entry — a swallowed handler keeps an
      // unawaited rejection from taking the process down.
      entry.promise.catch(() => undefined)
      cache.set(key, entry)
    }
  }

  return {
    prime,
    get(uniqueKeys) {
      prime(uniqueKeys)
      return Promise.all(
        uniqueKeys.map(
          (key) => cache.get(key)?.promise ?? Promise.resolve(fallback(key))
        )
      )
    },
    clear() {
      cache.clear()
    },
  }
}
