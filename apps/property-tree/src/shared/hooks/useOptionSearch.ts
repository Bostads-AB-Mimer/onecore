import { useCallback, useEffect, useState } from 'react'

import { useDebounce } from '@/shared/hooks/useDebounce'
import type { SearchFilterOption } from '@/shared/ui/filters/types'

interface UseOptionSearchArgs {
  /** Search only runs while this is true */
  open: boolean
  /** Called with the debounced text; must be a stable function */
  searchFn: (query: string) => Promise<SearchFilterOption[]>
  minSearchLength: number
  debounceMs: number
}

/** Outcome of the latest finished search, with the query it was made for */
interface SearchState {
  query: string
  results: SearchFilterOption[]
  error: boolean
}

/**
 * Debounced option search for a filter dropdown. Owns the search text, the
 * results and what to show for them. Call `reset` when the dropdown closes.
 */
export function useOptionSearch({
  open,
  searchFn,
  minSearchLength,
  debounceMs,
}: UseOptionSearchArgs) {
  const [searchInput, setSearchInput] = useState('')
  const [state, setState] = useState<SearchState | null>(null)

  const debouncedSearch = useDebounce(searchInput, debounceMs)

  useEffect(() => {
    if (!open) return
    if (debouncedSearch.length < minSearchLength) {
      setState(null)
      return
    }

    // Set by cleanup so a response for an older query, after closing or after unmount is dropped
    let ignore = false

    const search = async () => {
      try {
        const results = await searchFn(debouncedSearch)
        if (ignore) return
        setState({ query: debouncedSearch, results, error: false })
      } catch (err: unknown) {
        console.error('useOptionSearch: Search failed', err)
        if (ignore) return
        setState({ query: debouncedSearch, results: [], error: true })
      }
    }

    search()

    return () => {
      ignore = true
    }
  }, [open, debouncedSearch, minSearchLength, searchFn])

  /** Clear the text and results; a cancelled search must not leave the spinner or an old error behind */
  const reset = useCallback(() => {
    setSearchInput('')
    setState(null)
  }, [])

  const showResults = debouncedSearch.length >= minSearchLength
  // The shown outcome belongs to the text now in the field; until it does, a
  // search for that text is pending and only the spinner shows
  const current = showResults && state?.query === searchInput ? state : null
  const results = current?.results ?? []

  return {
    searchInput,
    setSearchInput,
    reset,
    results,
    showSpinner: showResults && !current,
    /** Too little text typed to search */
    showHint: !showResults,
    showError: current?.error ?? false,
    showEmpty: !!current && !current.error && results.length === 0,
    showOptions: results.length > 0,
  }
}
