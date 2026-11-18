/**
 * Runs work one at a time per key, within this process.
 *
 * Calls with the same key run in the order they arrived, each after the
 * previous one has settled; calls with different keys do not wait for each
 * other. A call that throws or rejects releases the key like one that
 * succeeds.
 *
 * In-process only: it serialises nothing across replicas. Use it where the
 * service runs as a single replica, and say so where it is used.
 */
export const createKeyedLock = () => {
  /** The tail of each key's queue; removed when the last call for it settles. */
  const tails = new Map<string, Promise<void>>()

  return async <T>(key: string, work: () => Promise<T>): Promise<T> => {
    const previous = tails.get(key) ?? Promise.resolve()

    // Definitely assigned: the Promise executor below runs synchronously.
    let release!: () => void
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => current)
    tails.set(key, tail)

    // `previous` never rejects: every tail resolves through `release`.
    await previous
    try {
      return await work()
    } finally {
      release()
      // Only the last caller for this key clears it, so the map does not grow.
      if (tails.get(key) === tail) tails.delete(key)
    }
  }
}
