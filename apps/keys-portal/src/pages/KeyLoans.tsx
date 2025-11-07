import { useState, useEffect, useCallback } from 'react'
import { KeyLoansHeader } from '@/components/key-loans/KeyLoansHeader'
import { KeyLoansTable } from '@/components/key-loans/KeyLoansTable'
import { Input } from '@/components/ui/input'

import { KeyLoan } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import { keyLoanService } from '@/services/api/keyLoanService'
import { useUrlPagination } from '@/hooks/useUrlPagination'
import { NullableDateFilterValue } from '@/components/ui/nullable-date-filter-dropdown'

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

  // Local state for search input (to allow typing without triggering URL changes)
  const [searchInput, setSearchInput] = useState(searchQuery)

  // Load key loans from API
  const loadKeyLoans = useCallback(async () => {
    try {
      setIsLoading(true)

      // Build search parameters
      const params: Record<string, string> = {}

      // Search query (searches by key name, rental object code, or contact)
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
      if (pickedUpAfter) {
        params.pickedUpAt = `>=${pickedUpAfter}`
      }
      if (pickedUpBefore) {
        params.pickedUpAt = params.pickedUpAt
          ? `${params.pickedUpAt},<=${pickedUpBefore}`
          : `<=${pickedUpBefore}`
      }

      // Returned date filters
      if (hasReturned !== null) {
        params.hasReturned = hasReturned
      }
      if (returnedAfter) {
        params.returnedAt = `>=${returnedAfter}`
      }
      if (returnedBefore) {
        params.returnedAt = params.returnedAt
          ? `${params.returnedAt},<=${returnedBefore}`
          : `<=${returnedBefore}`
      }

      // If no filters are set, use the list endpoint
      if (Object.keys(params).length === 0) {
        const loans = await keyLoanService.list()
        setKeyLoans(loans)
      } else {
        // Use search endpoint with filters
        const loans = await keyLoanService.search(params)
        setKeyLoans(loans)
      }
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
  }, [
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
    toast,
  ])

  // Sync local search input with URL query
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  // Fetch data whenever filters change
  useEffect(() => {
    loadKeyLoans()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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
  ])

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchInput(query)
      // Update URL with search query
      if (query.trim().length >= 3 || query.trim().length === 0) {
        pagination.updateUrlParams({
          q: query.trim().length > 0 ? query.trim() : null,
        })
      }
    },
    [pagination]
  )

  const handleLoanTypeFilterChange = useCallback(
    (value: string | null) => {
      pagination.updateUrlParams({
        loanType: value,
      })
    },
    [pagination]
  )

  const handleKeyCountChange = useCallback(
    (min: number | null, max: number | null) => {
      pagination.updateUrlParams({
        minKeys: min !== null ? min.toString() : null,
        maxKeys: max !== null ? max.toString() : null,
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
        totalLoans={keyLoans.length}
        activeLoans={activeLoanCount}
        returnedLoans={returnedLoanCount}
      />

      {/* Search input */}
      <div className="mb-4">
        <Input
          placeholder="Sök kontakt, nyckel eller objekt..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-md"
        />
      </div>

      <KeyLoansTable
        keyLoans={keyLoans}
        isLoading={isLoading}
        onRefresh={loadKeyLoans}
        loanTypeFilter={loanTypeFilter}
        onLoanTypeFilterChange={handleLoanTypeFilterChange}
        minKeys={minKeys}
        maxKeys={maxKeys}
        onKeyCountChange={handleKeyCountChange}
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
    </div>
  )
}
