import { useState, useEffect, useCallback } from 'react'
import { KeyLoansHeader } from '@/components/key-loans/KeyLoansHeader'
import { KeyLoansTable } from '@/components/key-loans/KeyLoansTable'
import { PaginationControls } from '@/components/common/PaginationControls'
import { Input } from '@/components/ui/input'

import { KeyLoan } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import { keyLoanService } from '@/services/api/keyLoanService'
import { useUrlPagination } from '@/hooks/useUrlPagination'

export default function KeyLoans() {
  const pagination = useUrlPagination()
  const [keyLoans, setKeyLoans] = useState<KeyLoan[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Read search query from URL
  const searchQuery = pagination.searchParams.get('q') || ''
  const loanTypeFilter = pagination.searchParams.get('loanType') || null
  const minKeys = pagination.searchParams.get('minKeys')
    ? parseInt(pagination.searchParams.get('minKeys')!, 10)
    : null
  const maxKeys = pagination.searchParams.get('maxKeys')
    ? parseInt(pagination.searchParams.get('maxKeys')!, 10)
    : null

  // Picked up date filters
  const hasPickedUp = pagination.searchParams.get('hasPickedUp')
  const pickedUpAfter = pagination.searchParams.get('pickedUpAfter')
  const pickedUpBefore = pagination.searchParams.get('pickedUpBefore')

  // Returned date filters
  const hasReturned = pagination.searchParams.get('hasReturned')
  const returnedAfter = pagination.searchParams.get('returnedAfter')
  const returnedBefore = pagination.searchParams.get('returnedBefore')

  // Created date filters
  const createdAtAfter = pagination.searchParams.get('createdAtAfter') || null
  const createdAtBefore = pagination.searchParams.get('createdAtBefore') || null

  // Local state for search input (to allow typing without triggering URL changes)
  const [searchInput, setSearchInput] = useState(searchQuery)

  // Load key loans from API
  const loadKeyLoans = useCallback(
    async (page: number = 1, limit: number = 60) => {
      try {
        setIsLoading(true)

        // Build search parameters
        const params: Record<string, string | string[]> = {}

        // Search query (searches by key name, rental object code, contact, or contact2)
        if (searchQuery.trim().length >= 3) {
          params.keyNameOrObjectCode = searchQuery.trim()
        }

        // Loan type filter
        if (loanTypeFilter) {
          params.loanType = loanTypeFilter
        }

        // Key count filters
        if (minKeys !== null) {
          params.minKeys = minKeys.toString()
        }
        if (maxKeys !== null) {
          params.maxKeys = maxKeys.toString()
        }

        // Picked up date filters
        if (hasPickedUp !== null) {
          params.hasPickedUp = hasPickedUp
        }
        const pickedUpDateFilters: string[] = []
        if (pickedUpAfter) {
          pickedUpDateFilters.push(`>=${pickedUpAfter}`)
        }
        if (pickedUpBefore) {
          pickedUpDateFilters.push(`<=${pickedUpBefore}`)
        }
        if (pickedUpDateFilters.length > 0) {
          params.pickedUpAt =
            pickedUpDateFilters.length === 1
              ? pickedUpDateFilters[0]
              : pickedUpDateFilters
        }

        // Returned date filters
        if (hasReturned !== null) {
          params.hasReturned = hasReturned
        }
        const returnedDateFilters: string[] = []
        if (returnedAfter) {
          returnedDateFilters.push(`>=${returnedAfter}`)
        }
        if (returnedBefore) {
          returnedDateFilters.push(`<=${returnedBefore}`)
        }
        if (returnedDateFilters.length > 0) {
          params.returnedAt =
            returnedDateFilters.length === 1
              ? returnedDateFilters[0]
              : returnedDateFilters
        }

        // Created date filters
        const createdDateFilters: string[] = []
        if (createdAtAfter) {
          createdDateFilters.push(`>=${createdAtAfter}`)
        }
        if (createdAtBefore) {
          createdDateFilters.push(`<=${createdAtBefore}`)
        }
        if (createdDateFilters.length > 0) {
          params.createdAt =
            createdDateFilters.length === 1
              ? createdDateFilters[0]
              : createdDateFilters
        }

        // Always use search endpoint with pagination (even with empty params)
        const response = await keyLoanService.search(params, page, limit)
        setKeyLoans(response.content)
        pagination.setPaginationMeta(response._meta)
      } catch (error) {
        console.error('Failed to load key loans:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ladda nyckellån.',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    },
    [
      searchQuery,
      loanTypeFilter,
      minKeys,
      maxKeys,
      hasPickedUp,
      pickedUpAfter,
      pickedUpBefore,
      hasReturned,
      returnedAfter,
      returnedBefore,
      createdAtAfter,
      createdAtBefore,
      toast,
      pagination.setPaginationMeta,
    ]
  )

  // Sync local search input with URL query
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  // Fetch data whenever filters or pagination changes
  useEffect(() => {
    loadKeyLoans(pagination.currentPage, pagination.currentLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.currentPage,
    pagination.currentLimit,
    searchQuery,
    loanTypeFilter,
    minKeys,
    maxKeys,
    hasPickedUp,
    pickedUpAfter,
    pickedUpBefore,
    hasReturned,
    returnedAfter,
    returnedBefore,
    createdAtAfter,
    createdAtBefore,
  ])

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchInput(query)
      // Update URL with search query and reset to page 1
      if (query.trim().length >= 3 || query.trim().length === 0) {
        pagination.updateUrlParams({
          q: query.trim().length > 0 ? query.trim() : null,
          page: '1',
        })
      }
    },
    [pagination]
  )

  const handleLoanTypeFilterChange = useCallback(
    (value: string | null) => {
      pagination.updateUrlParams({
        loanType: value,
        page: '1',
      })
    },
    [pagination]
  )

  const handleKeyCountChange = useCallback(
    (min: number | null, max: number | null) => {
      pagination.updateUrlParams({
        minKeys: min !== null ? min.toString() : null,
        maxKeys: max !== null ? max.toString() : null,
        page: '1',
      })
    },
    [pagination]
  )

  const handlePickedUpDateChange = useCallback(
    (value: NullableDateFilterValue) => {
      pagination.updateUrlParams({
        hasPickedUp:
          value.hasValue === null ? null : value.hasValue ? 'true' : 'false',
        pickedUpAfter: value.after,
        pickedUpBefore: value.before,
        page: '1',
      })
    },
    [pagination]
  )

  const handleReturnedDateChange = useCallback(
    (value: NullableDateFilterValue) => {
      pagination.updateUrlParams({
        hasReturned:
          value.hasValue === null ? null : value.hasValue ? 'true' : 'false',
        returnedAfter: value.after,
        returnedBefore: value.before,
        page: '1',
      })
    },
    [pagination]
  )

  const handleCreatedAtDateChange = useCallback(
    (afterDate: string | null, beforeDate: string | null) => {
      pagination.updateUrlParams({
        createdAtAfter: afterDate,
        createdAtBefore: beforeDate,
        page: '1',
      })
    },
    [pagination]
  )

  // Count active and returned loans
  const activeLoanCount = keyLoans.filter((loan) => !loan.returnedAt).length
  const returnedLoanCount = keyLoans.filter((loan) => loan.returnedAt).length

  return (
    <div className="container mx-auto py-8 px-4">
      <KeyLoansHeader
        totalLoans={pagination.paginationMeta.totalRecords || keyLoans.length}
        activeLoans={activeLoanCount}
        returnedLoans={returnedLoanCount}
      />

      {/* Search input */}
      <div className="mb-4">
        <Input
          placeholder="Sök kundnummer, nyckel eller objekt..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-md"
        />
      </div>

      <KeyLoansTable
        keyLoans={keyLoans}
        isLoading={isLoading}
        onRefresh={() =>
          loadKeyLoans(pagination.currentPage, pagination.currentLimit)
        }
        loanTypeFilter={loanTypeFilter}
        onLoanTypeFilterChange={handleLoanTypeFilterChange}
        minKeys={minKeys}
        maxKeys={maxKeys}
        onKeyCountChange={handleKeyCountChange}
        createdAtAfter={createdAtAfter}
        createdAtBefore={createdAtBefore}
        onCreatedAtDateChange={handleCreatedAtDateChange}
        pickedUpDateFilter={{
          hasValue: hasPickedUp === null ? null : hasPickedUp === 'true',
          after: pickedUpAfter || null,
          before: pickedUpBefore || null,
        }}
        onPickedUpDateChange={handlePickedUpDateChange}
        returnedDateFilter={{
          hasValue: hasReturned === null ? null : hasReturned === 'true',
          after: returnedAfter || null,
          before: returnedBefore || null,
        }}
        onReturnedDateChange={handleReturnedDateChange}
      />

      <PaginationControls
        paginationMeta={pagination.paginationMeta}
        pageLimit={pagination.currentLimit}
        customLimit={pagination.customLimit}
        isFocused={pagination.isFocused}
        onPageChange={pagination.handlePageChange}
        onLimitChange={pagination.handleLimitChange}
        onCustomLimitChange={pagination.setCustomLimit}
        onCustomLimitSubmit={pagination.handleCustomLimitSubmit}
        onFocusChange={pagination.setIsFocused}
      />
    </div>
  )
}
