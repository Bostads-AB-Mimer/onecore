/**
 * Runs `worker` over `items` with at most `concurrency` in flight at once,
 * preserving each result at its original index.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = cursor++
        if (index >= items.length) return
        results[index] = await worker(items[index])
      }
    }
  )

  await Promise.all(runners)
  return results
}
