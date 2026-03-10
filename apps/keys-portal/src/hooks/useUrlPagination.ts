import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PaginationMeta } from '@/services/types'

export function useUrlPagination() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [customLimit, setCustomLimit] = useState<string>('')
  const [isFocused, setIsFocused] = useState(false)

  // Pagination metadata from API response
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    totalRecords: 0,
    page: 1,
    limit: 60,
    count: 0,
  })

  // Read pagination params from URL
  const currentPage = Number(searchParams.get('page')) || 1
  const currentLimit = Number(searchParams.get('limit')) || 60

  // Derived values
  const totalPages = Math.ceil(paginationMeta.totalRecords / currentLimit)

  // Helper to update URL params
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams)
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          newParams.set(key, value)
        } else {
          newParams.delete(key)
        }
      })
      setSearchParams(newParams)
    },
    [searchParams, setSearchParams]
  )

  // Pagination handlers
  const handlePageChange = useCallback(
    (newPage: number) => {
      updateUrlParams({ page: String(newPage) })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [updateUrlParams]
  )

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      updateUrlParams({ limit: String(newLimit), page: '1' })
    },
    [updateUrlParams]
  )

  const handleCustomLimitSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const parsed = parseInt(customLimit)
        if (parsed > 0) {
          setCustomLimit('')
          updateUrlParams({ limit: String(parsed), page: '1' })
          e.currentTarget.blur()
        }
      }
    },
    [customLimit, updateUrlParams]
  )

  return {
    // URL params
    searchParams,
    updateUrlParams,

    // Pagination state
    paginationMeta,
    setPaginationMeta,
    currentPage,
    currentLimit,
    totalPages,

    // Custom limit input state
    customLimit,
    setCustomLimit,
    isFocused,
    setIsFocused,

    // Handlers
    handlePageChange,
    handleLimitChange,
    handleCustomLimitSubmit,
  }
}
