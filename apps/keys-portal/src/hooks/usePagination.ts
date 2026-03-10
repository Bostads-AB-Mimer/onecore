import { useState, useCallback } from 'react'

export interface PaginationMeta {
  totalRecords: number
  page: number
  limit: number
  count: number
}

export interface UsePaginationOptions {
  initialLimit?: number
  onPageChange?: (page: number, limit: number) => void
}

export function usePagination(options: UsePaginationOptions = {}) {
  const { initialLimit = 60, onPageChange } = options

  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    totalRecords: 0,
    page: 1,
    limit: initialLimit,
    count: 0,
  })
  const [pageLimit, setPageLimit] = useState<number>(initialLimit)
  const [customLimit, setCustomLimit] = useState<string>('')
  const [isFocused, setIsFocused] = useState(false)

  const totalPages = Math.ceil(
    paginationMeta.totalRecords / paginationMeta.limit
  )
  const currentPage = paginationMeta.page

  const handlePageChange = useCallback(
    (newPage: number) => {
      onPageChange?.(newPage, pageLimit)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [onPageChange, pageLimit]
  )

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      setPageLimit(newLimit)
      onPageChange?.(1, newLimit)
    },
    [onPageChange]
  )

  const handleCustomLimitSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const parsed = parseInt(customLimit)
        if (parsed > 0) {
          setPageLimit(parsed)
          setCustomLimit('')
          onPageChange?.(1, parsed)
          e.currentTarget.blur()
        }
      }
    },
    [customLimit, onPageChange]
  )

  return {
    paginationMeta,
    setPaginationMeta,
    pageLimit,
    customLimit,
    setCustomLimit,
    isFocused,
    setIsFocused,
    totalPages,
    currentPage,
    handlePageChange,
    handleLimitChange,
    handleCustomLimitSubmit,
  }
}
