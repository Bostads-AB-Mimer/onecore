import { useState, useCallback } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

/**
 * Custom hook för att hantera asynkrona operationer
 * @param asyncFunction Den asynkrona funktionen som ska köras
 * @returns Ett objekt med data, laddningstillstånd och eventuella fel
 */
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate = true
): AsyncState<T> & { execute: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  })

  const execute = useCallback(async () => {
    setState(prevState => ({ ...prevState, loading: true }))
    try {
      const data = await asyncFunction()
      setState({ data, loading: false, error: null })
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error })
    }
  }, [asyncFunction])

  // Kör funktionen direkt om immediate är true
  useState(() => {
    if (immediate) {
      execute()
    }
  })

  return { ...state, execute }
}
