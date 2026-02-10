import { useSearchParams } from 'react-router-dom'
import { useCallback, useMemo } from 'react'

interface UseUrlPaginationOptions {
  defaultPage?: number
  defaultLimit?: number
}

export const useUrlPagination = (options: UseUrlPaginationOptions = {}) => {
  const { defaultPage = 1, defaultLimit = 25 } = options
  const [searchParams, setSearchParams] = useSearchParams()

  // Parse current values from URL
  const page = useMemo(() => {
    const p = searchParams.get('page')
    return p ? parseInt(p, 10) : defaultPage
  }, [searchParams, defaultPage])

  const limit = useMemo(() => {
    const l = searchParams.get('limit')
    return l ? parseInt(l, 10) : defaultLimit
  }, [searchParams, defaultLimit])

  const search = useMemo(() => {
    return searchParams.get('search') || ''
  }, [searchParams])

  // Core function: merge new params with existing ones
  const updateUrlParams = useCallback(
    (
      params: Record<string, string | number | undefined>,
      { replace = false }: { replace?: boolean } = {}
    ) => {
      const newParams = new URLSearchParams(searchParams)

      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === '') {
          newParams.delete(key)
        } else {
          newParams.set(key, String(value))
        }
      })

      setSearchParams(newParams, { replace })
    },
    [searchParams, setSearchParams]
  )

  // Convenience setters
  const setPage = useCallback(
    (newPage: number) => {
      updateUrlParams({ page: newPage === defaultPage ? undefined : newPage })
    },
    [updateUrlParams, defaultPage]
  )

  const setLimit = useCallback(
    (newLimit: number) => {
      updateUrlParams({
        limit: newLimit === defaultLimit ? undefined : newLimit,
        page: undefined, // Reset to page 1 when limit changes
      })
    },
    [updateUrlParams, defaultLimit]
  )

  const setSearch = useCallback(
    (newSearch: string, { replace = true }: { replace?: boolean } = {}) => {
      updateUrlParams(
        {
          search: newSearch.trim() || undefined,
          page: undefined, // Reset to page 1 when search changes
        },
        { replace }
      )
    },
    [updateUrlParams]
  )

  const resetPagination = useCallback(() => {
    updateUrlParams({ page: undefined, limit: undefined })
  }, [updateUrlParams])

  return {
    searchParams,
    setSearchParams,
    page,
    limit,
    search,
    updateUrlParams,
    setPage,
    setLimit,
    setSearch,
    resetPagination,
  }
}
