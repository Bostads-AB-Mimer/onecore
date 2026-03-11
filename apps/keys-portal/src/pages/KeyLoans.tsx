import { useState, useEffect, useCallback } from 'react'
import { ListPageLayout } from '@/components/shared/layout'
import { Badge } from '@/components/ui/badge'
import { KeyLoansTable } from '@/components/key-loans/KeyLoansTable'
import { EditKeyLoanForm } from '@/components/key-loans/EditKeyLoanForm'

import { KeyLoan } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import { keyLoanService } from '@/services/api/keyLoanService'
import { useUrlPagination } from '@/hooks/useUrlPagination'
import { useEditKeyLoanHandlers } from '@/hooks/useEditKeyLoanHandlers'
import { useStaleGuard } from '@/hooks/useStaleGuard'

export default function KeyLoans() {
  const pagination = useUrlPagination()
  const [keyLoans, setKeyLoans] = useState<KeyLoan[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingKeyLoan, setEditingKeyLoan] = useState<KeyLoan | null>(null)
  const { toast } = useToast()
  const checkStale = useStaleGuard()

  // Read search query from URL
  const searchQuery = pagination.searchParams.get('q') || ''
  const loanTypeFilter = pagination.searchParams.get('loanType') || null
  const editLoanIdFromUrl = pagination.searchParams.get('editLoanId')
  const expandLoanIdFromUrl = pagination.searchParams.get('expandLoanId')
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
      const isStale = checkStale()
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

        // Ignore stale responses from earlier requests
        if (isStale()) return

        setKeyLoans(response.content)
        pagination.setPaginationMeta(response._meta)
      } catch (error) {
        if (isStale()) return
        console.error('Failed to load key loans:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ladda nyckellån.',
          variant: 'destructive',
        })
      } finally {
        if (!isStale()) setIsLoading(false)
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

  // Ensure the loan to auto-expand is in the list (it may not be on the current page)
  useEffect(() => {
    if (expandLoanIdFromUrl && keyLoans.length > 0) {
      const exists = keyLoans.some((loan) => loan.id === expandLoanIdFromUrl)
      if (!exists) {
        keyLoanService
          .get(expandLoanIdFromUrl)
          .then((loan) => {
            setKeyLoans((prev) => [loan as KeyLoan, ...prev])
          })
          .catch((error) => {
            console.error('Failed to load loan for expand:', error)
          })
      }
    }
  }, [expandLoanIdFromUrl, keyLoans])

  // Auto-open edit form when editLoanId is in URL
  useEffect(() => {
    if (editLoanIdFromUrl && keyLoans.length > 0) {
      // Always fetch with details so keysArray is available in the edit form
      keyLoanService
        .get(editLoanIdFromUrl, {
          includeKeySystem: true,
          includeCards: true,
        })
        .then((loan) => {
          setEditingKeyLoan(loan as KeyLoan)
          setShowEditForm(true)
        })
        .catch((error) => {
          console.error('Failed to load loan for editing:', error)
          toast({
            title: 'Fel',
            description: 'Kunde inte ladda lånet för redigering',
            variant: 'destructive',
          })
        })
      // Clear the URL param after opening
      pagination.updateUrlParams({ editLoanId: null })
    }
  }, [editLoanIdFromUrl, keyLoans, pagination, toast])

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

  const handleEdit = useCallback(async (loan: KeyLoan) => {
    try {
      const enriched = await keyLoanService.get(loan.id, {
        includeKeySystem: true,
        includeCards: true,
      })
      setEditingKeyLoan(enriched as KeyLoan)
      setShowEditForm(true)
    } catch {
      // Fall back to plain loan if fetch fails
      setEditingKeyLoan(loan)
      setShowEditForm(true)
    }
  }, [])

  const refreshList = useCallback(
    () => loadKeyLoans(pagination.currentPage, pagination.currentLimit),
    [loadKeyLoans, pagination.currentPage, pagination.currentLimit]
  )

  const {
    handleSave: sharedHandleSave,
    handleReceiptUpload,
    handleReceiptDownload,
    handleReceiptDelete,
    handleDelete: sharedHandleDelete,
  } = useEditKeyLoanHandlers({
    onSuccess: refreshList,
    onClose: () => {
      setShowEditForm(false)
      setEditingKeyLoan(null)
    },
  })

  const handleSave = useCallback(
    async (loanData: Parameters<typeof sharedHandleSave>[1]) => {
      if (!editingKeyLoan) return
      setIsLoading(true)
      await sharedHandleSave(editingKeyLoan.id, loanData)
      setIsLoading(false)
    },
    [editingKeyLoan, sharedHandleSave]
  )

  const handleCancel = useCallback(() => {
    setShowEditForm(false)
    setEditingKeyLoan(null)
  }, [])

  const handleDelete = useCallback(
    async (loan: KeyLoan) => {
      // Frontend validation - UX improvement
      const isActive = loan.pickedUpAt && !loan.returnedAt
      if (isActive) {
        toast({
          title: 'Kan inte ta bort aktivt lån',
          description:
            'Lånet kan inte tas bort medan nycklar är uthyrda till hyresgäst.',
          variant: 'destructive',
        })
        return
      }

      if (
        !confirm(
          'Är du säker på att du vill ta bort detta lån? Detta går inte att ångra.'
        )
      ) {
        return
      }

      setIsLoading(true)
      await sharedHandleDelete(loan.id)
      setIsLoading(false)
    },
    [toast, sharedHandleDelete]
  )

  // Count active and returned loans
  const activeLoanCount = keyLoans.filter((loan) => !loan.returnedAt).length
  const returnedLoanCount = keyLoans.filter((loan) => loan.returnedAt).length

  return (
    <ListPageLayout
      title="Nyckellån"
      subtitle={`${keyLoans.length} av ${pagination.paginationMeta.totalRecords || keyLoans.length} lån`}
      badges={
        <>
          <Badge variant="default" className="text-xs">
            {activeLoanCount} aktiva
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {returnedLoanCount} återlämnade
          </Badge>
        </>
      }
      searchValue={searchInput}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Sök kundnummer, nyckel eller objekt..."
      pagination={pagination}
    >
      {showEditForm && editingKeyLoan && (
        <EditKeyLoanForm
          editingKeyLoan={editingKeyLoan}
          onSave={handleSave}
          onCancel={handleCancel}
          onReceiptUpload={handleReceiptUpload}
          onReceiptDownload={handleReceiptDownload}
          onReceiptDelete={handleReceiptDelete}
          onDelete={async (loanId) => {
            const loan = keyLoans.find((l) => l.id === loanId)
            if (loan) await handleDelete(loan)
          }}
        />
      )}

      <KeyLoansTable
        keyLoans={keyLoans}
        isLoading={isLoading}
        onRefresh={() =>
          loadKeyLoans(pagination.currentPage, pagination.currentLimit)
        }
        onEdit={handleEdit}
        onDelete={handleDelete}
        autoExpandLoanId={expandLoanIdFromUrl}
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
    </ListPageLayout>
  )
}
