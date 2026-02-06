import { useState, useEffect, useCallback } from 'react'
import { ListPageLayout } from '@/components/shared/layout'
import { Badge } from '@/components/ui/badge'
import { KeyLoansTable } from '@/components/key-loans/KeyLoansTable'
import { EditKeyLoanForm } from '@/components/key-loans/EditKeyLoanForm'

import { KeyLoan, UpdateKeyLoanRequest } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import { keyLoanService } from '@/services/api/keyLoanService'
import { receiptService } from '@/services/api/receiptService'
import { useUrlPagination } from '@/hooks/useUrlPagination'

export default function KeyLoans() {
  const pagination = useUrlPagination()
  const [keyLoans, setKeyLoans] = useState<KeyLoan[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingKeyLoan, setEditingKeyLoan] = useState<KeyLoan | null>(null)
  const { toast } = useToast()

  // Read search query from URL
  const searchQuery = pagination.searchParams.get('q') || ''
  const loanTypeFilter = pagination.searchParams.get('loanType') || null
  const editLoanIdFromUrl = pagination.searchParams.get('editLoanId')
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

  // Auto-open edit form when editLoanId is in URL
  useEffect(() => {
    if (editLoanIdFromUrl && keyLoans.length > 0) {
      const loanToEdit = keyLoans.find((loan) => loan.id === editLoanIdFromUrl)
      if (loanToEdit) {
        setEditingKeyLoan(loanToEdit)
        setShowEditForm(true)
      } else {
        // Loan not in current page - fetch it directly
        keyLoanService
          .get(editLoanIdFromUrl)
          .then((loan) => {
            setEditingKeyLoan(loan)
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
      }
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

  const handleEdit = useCallback((loan: KeyLoan) => {
    setEditingKeyLoan(loan)
    setShowEditForm(true)
  }, [])

  const handleSave = useCallback(
    async (loanData: UpdateKeyLoanRequest, receiptFile?: File | null) => {
      if (!editingKeyLoan) return

      try {
        setIsLoading(true)
        await keyLoanService.update(editingKeyLoan.id, loanData)

        toast({
          title: 'Uppdaterat',
          description: 'Nyckellånet har uppdaterats',
        })

        setShowEditForm(false)
        setEditingKeyLoan(null)

        // Refresh the list
        await loadKeyLoans(pagination.currentPage, pagination.currentLimit)
      } catch (error) {
        console.error('Failed to update key loan:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte uppdatera nyckellånet',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    },
    [
      editingKeyLoan,
      toast,
      pagination.currentPage,
      pagination.currentLimit,
      loadKeyLoans,
    ]
  )

  const handleCancel = useCallback(() => {
    setShowEditForm(false)
    setEditingKeyLoan(null)
  }, [])

  const handleReceiptUpload = useCallback(
    async (loanId: string, file: File) => {
      try {
        // Get existing receipts for this loan
        const receipts = await receiptService.getByKeyLoan(loanId)
        const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')

        // Create receipt with file or upload to existing receipt
        if (!loanReceipt) {
          // Create new receipt with file in single call
          await receiptService.createWithFile(
            {
              keyLoanId: loanId,
              receiptType: 'LOAN',
              type: 'DIGITAL',
            },
            file
          )
        } else {
          // Upload/replace file on existing receipt
          await receiptService.uploadFile(loanReceipt.id, file)
        }

        toast({
          title: loanReceipt?.fileId ? 'Kvittens ersatt' : 'Kvittens uppladdad',
          description: loanReceipt?.fileId
            ? 'Den nya kvittensen har ersatt den gamla'
            : 'Kvittensen har laddats upp',
        })

        // Refresh the list
        await loadKeyLoans(pagination.currentPage, pagination.currentLimit)
      } catch (error) {
        console.error('Failed to upload receipt:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ladda upp kvittensen',
          variant: 'destructive',
        })
        throw error
      }
    },
    [toast, pagination.currentPage, pagination.currentLimit, loadKeyLoans]
  )

  const handleReceiptDownload = useCallback(
    async (loanId: string) => {
      try {
        // Get receipts for this loan
        const receipts = await receiptService.getByKeyLoan(loanId)
        const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')

        if (loanReceipt) {
          await receiptService.downloadFile(loanReceipt.id)
        }
      } catch (error) {
        console.error('Failed to download receipt:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ladda ner kvittensen',
          variant: 'destructive',
        })
        throw error
      }
    },
    [toast]
  )

  const handleReceiptDelete = useCallback(
    async (loanId: string) => {
      try {
        // Get receipts for this loan
        const receipts = await receiptService.getByKeyLoan(loanId)
        const loanReceipt = receipts.find((r) => r.receiptType === 'LOAN')

        if (loanReceipt) {
          // Delete the receipt file
          await receiptService.remove(loanReceipt.id)

          // Clear pickedUpAt to revert loan to "Ej upphämtat" status
          await keyLoanService.update(loanId, {
            pickedUpAt: null,
          })

          toast({
            title: 'Kvittens borttagen',
            description:
              'Kvittensen har tagits bort och lånet är nu markerat som ej upphämtat',
          })

          // Refresh the list
          await loadKeyLoans(pagination.currentPage, pagination.currentLimit)
        }
      } catch (error) {
        console.error('Failed to delete receipt:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ta bort kvittensen',
          variant: 'destructive',
        })
        throw error
      }
    },
    [toast, pagination.currentPage, pagination.currentLimit, loadKeyLoans]
  )

  const handleDelete = useCallback(
    async (loan: KeyLoan) => {
      // Check if loan is active (frontend validation - UX improvement)
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

      // Confirm deletion
      if (
        !confirm(
          'Är du säker på att du vill ta bort detta lån? Detta går inte att ångra.'
        )
      ) {
        return
      }

      try {
        setIsLoading(true)
        await keyLoanService.remove(loan.id)

        toast({
          title: 'Nyckellån borttaget',
          description: 'Lånet har tagits bort',
        })

        // Close edit form if we're deleting the loan being edited
        if (editingKeyLoan?.id === loan.id) {
          setShowEditForm(false)
          setEditingKeyLoan(null)
        }

        // Refresh list
        await loadKeyLoans(pagination.currentPage, pagination.currentLimit)
      } catch (error: any) {
        console.error('Failed to delete loan:', error)

        // Check for specific error code from backend
        if (error?.data?.code === 'ACTIVE_LOAN_CANNOT_DELETE') {
          toast({
            title: 'Kan inte ta bort aktivt lån',
            description: 'Lånet kan inte tas bort medan nycklar är uthyrda.',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Kunde inte ta bort lånet',
            description: 'Ett fel uppstod när lånet skulle tas bort',
            variant: 'destructive',
          })
        }
      } finally {
        setIsLoading(false)
      }
    },
    [
      editingKeyLoan,
      toast,
      pagination.currentPage,
      pagination.currentLimit,
      loadKeyLoans,
    ]
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
