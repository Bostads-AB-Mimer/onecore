import { useCallback, useEffect, useState } from 'react'

import { useDebounce } from '@/shared/hooks/useDebounce'
import type { SearchFilterOption } from '@/shared/ui/filters/MultiSelectSearchFilterDropdown'

interface UseOptionSearchArgs {
  /** Search only runs while this is true */
  open: boolean
  /** Called with the debounced text; must be a stable function */
  searchFn: (query: string) => Promise<SearchFilterOption[]>
  minSearchLength: number
  debounceMs: number
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
  const [results, setResults] = useState<SearchFilterOption[]>([])
  // Query the current results (or error) came from
  const [resultsQuery, setResultsQuery] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)

  const debouncedSearch = useDebounce(searchInput, debounceMs)

  useEffect(() => {
    if (!open) return
    if (debouncedSearch.length < minSearchLength) {
      setResults([])
      setResultsQuery(null)
      setIsSearching(false)
      setSearchError(false)
      return
    }

    // Set by cleanup so a response for an older query, after closing or after unmount is dropped
    let ignore = false

    const search = async () => {
      setIsSearching(true)
      setSearchError(false)
      try {
        const searchResults = await searchFn(debouncedSearch)
        if (ignore) return
        setResults(searchResults)
        setResultsQuery(debouncedSearch)
      } catch (err: unknown) {
        console.error('useOptionSearch: Search failed', err)
        if (ignore) return
        setResults([])
        setResultsQuery(debouncedSearch)
        setSearchError(true)
      } finally {
        if (!ignore) setIsSearching(false)
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
    setResults([])
    setResultsQuery(null)
    setIsSearching(false)
    setSearchError(false)
  }, [])

  const showResults = debouncedSearch.length >= minSearchLength
  // Results (or error) belong to the text now in the field
  const resultsAreCurrent = resultsQuery === searchInput
  const showSpinner = isSearching || (showResults && !resultsAreCurrent)
  const showCurrent = showResults && resultsAreCurrent && !isSearching

  return {
    searchInput,
    setSearchInput,
    reset,
    results,
    showSpinner,
    /** Too little text typed to search */
    showHint: !showResults,
    showError: showCurrent && searchError,
    showEmpty: showCurrent && !searchError && results.length === 0,
    showOptions: showResults && resultsAreCurrent && results.length > 0,
  }
}
