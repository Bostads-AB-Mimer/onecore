import { useRef, useCallback } from 'react'

/**
 * Returns a function that creates a staleness checker.
 * Call it at the start of an async operation — it returns an `isStale()`
 * function you check after each await to discard responses from
 * superseded requests.
 *
 * @example
 * const checkStale = useStaleGuard()
 *
 * const fetchData = useCallback(async () => {
 *   const isStale = checkStale()
 *   setLoading(true)
 *   try {
 *     const response = await api.search(params)
 *     if (isStale()) return
 *     setData(response.content)
 *   } catch (error) {
 *     if (isStale()) return
 *     // handle error
 *   } finally {
 *     if (!isStale()) setLoading(false)
 *   }
 * }, [deps])
 */
export function useStaleGuard() {
  const idRef = useRef(0)
  return useCallback(() => {
    const id = ++idRef.current
    return () => id !== idRef.current
  }, [])
}