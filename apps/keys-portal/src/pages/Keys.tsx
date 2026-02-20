import { useState, useEffect, useCallback, useMemo } from 'react'
import { ListPageLayout } from '@/components/shared/layout'
import { KeysTable } from '@/components/keys/KeysTable'
import { AddKeyForm } from '@/components/keys/AddKeyForm'
import { ConfirmDialog } from '@/components/shared/dialogs/ConfirmDialog'
import { BulkActionBar } from '@/components/ui/BulkActionBar'
import { BulkEditKeysForm } from '@/components/keys/BulkEditKeysForm'
import { BulkDeleteKeysDialog } from '@/components/keys/dialogs/BulkDeleteKeysDialog'
import { useToast } from '@/hooks/use-toast'
import { useUrlPagination } from '@/hooks/useUrlPagination'
import { useStaleGuard } from '@/hooks/useStaleGuard'
import { useItemSelection } from '@/hooks/useItemSelection'
import { Key, KeyDetails, KeySystem } from '@/services/types'
import { keyService } from '@/services/api/keyService'
import { keyEventService } from '@/services/api/keyEventService'
import { keySystemSearchService } from '@/services/api/keySystemSearchService'
import { keyLoanService } from '@/services/api/keyLoanService'
import { SearchDropdown } from '@/components/ui/search-dropdown'
import { Pencil, Trash2 } from 'lucide-react'

const Index = () => {
  const pagination = useUrlPagination()
  const [keys, setKeys] = useState<KeyDetails[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [keySystemMap, setKeySystemMap] = useState<Record<string, string>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKey, setEditingKey] = useState<Key | null>(null)
  const [deletingKey, setDeletingKey] = useState<KeyDetails | null>(null)
  const { toast } = useToast()
  const checkStale = useStaleGuard()

  // Read all filters from URL
  const searchQuery = pagination.searchParams.get('q') || ''
  const selectedTypeFilter = pagination.searchParams.get('keyType') || null
  const selectedDisposedFilter = pagination.searchParams.get('disposed') || null
  const createdAtAfter = pagination.searchParams.get('createdAtAfter') || null
  const createdAtBefore = pagination.searchParams.get('createdAtBefore') || null
  const rentalObjectCode =
    pagination.searchParams.get('rentalObjectCode') || null
  const editKeyId = pagination.searchParams.get('editKeyId') || null
  const keySystemIdFilter = pagination.searchParams.get('keySystemId') || null

  // Local state for search input (to allow typing without triggering URL changes)
  const [searchInput, setSearchInput] = useState(searchQuery)
  const [keySystemSearch, setKeySystemSearch] = useState('')
  const [selectedKeySystem, setSelectedKeySystem] = useState<KeySystem | null>(
    null
  )

  // Bulk selection state
  const keySelection = useItemSelection()
  const [showBulkEditForm, setShowBulkEditForm] = useState(false)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [keysWithActiveLoans, setKeysWithActiveLoans] = useState<Key[]>([])

  const fetchKeys = useCallback(
    async (page: number = 1, limit: number = 60) => {
      const isStale = checkStale()
      setLoading(true)
      setError('')
      try {
        // Build search parameters based on current filters
        const searchParams: Record<string, string | string[]> = {}

        // Add search query if present
        if (searchQuery.trim().length >= 2) {
          searchParams.q = searchQuery.trim()
          searchParams.fields = 'keyName,rentalObjectCode,keySystemId'
        }

        // Add column filters
        if (selectedTypeFilter) {
          searchParams.keyType = selectedTypeFilter
        }
        if (selectedDisposedFilter) {
          searchParams.disposed = selectedDisposedFilter
        }
        if (rentalObjectCode) {
          searchParams.rentalObjectCode = rentalObjectCode
        }
        if (keySystemIdFilter) {
          searchParams.keySystemId = keySystemIdFilter
        }

        // Add date filters
        const dateFilters: string[] = []
        if (createdAtAfter) {
          dateFilters.push(`>=${createdAtAfter}`)
        }
        if (createdAtBefore) {
          dateFilters.push(`<=${createdAtBefore}`)
        }
        if (dateFilters.length > 0) {
          searchParams.createdAt =
            dateFilters.length === 1 ? dateFilters[0] : dateFilters
        }

        // Use search endpoint if filtering/searching, otherwise use getAllKeys
        // Include key system data in single request to avoid N+1 queries
        const hasFilters = Object.keys(searchParams).length > 0
        const response = hasFilters
          ? await keyService.searchKeys(searchParams, page, limit, true)
          : await keyService.getAllKeys(page, limit, true)

        if (isStale()) return

        setKeys(response.content)
        pagination.setPaginationMeta(response._meta)

        // Build key system map from included key system data (no additional API calls needed!)
        const systemMap: Record<string, string> = {}
        response.content.forEach((key) => {
          if (key.keySystemId && key.keySystem) {
            systemMap[key.keySystemId] = key.keySystem.systemCode
          }
        })
        setKeySystemMap(systemMap)
      } catch (e) {
        if (isStale()) return
        const msg = e instanceof Error ? e.message : 'Okänt fel'
        setError(msg)
        toast({
          title: 'Kunde inte hämta nycklar',
          description: msg,
          variant: 'destructive',
        })
      } finally {
        if (!isStale()) setLoading(false)
      }
    },
    [
      searchQuery,
      selectedTypeFilter,
      selectedDisposedFilter,
      rentalObjectCode,
      keySystemIdFilter,
      createdAtAfter,
      createdAtBefore,
      toast,
      pagination.setPaginationMeta,
    ]
  )

  // Fetch data whenever URL params change
  useEffect(() => {
    fetchKeys(pagination.currentPage, pagination.currentLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.currentPage,
    pagination.currentLimit,
    searchQuery,
    selectedTypeFilter,
    selectedDisposedFilter,
    rentalObjectCode,
    keySystemIdFilter,
    createdAtAfter,
    createdAtBefore,
    // fetchKeys intentionally omitted to prevent infinite loop
  ])

  // Sync search input with URL when URL changes
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  // Clear selection when page or filters change
  useEffect(() => {
    keySelection.deselectAll()
  }, [
    pagination.currentPage,
    searchQuery,
    selectedTypeFilter,
    selectedDisposedFilter,
    rentalObjectCode,
    keySystemIdFilter,
    createdAtAfter,
    createdAtBefore,
  ])

  // Handle auto-open edit form when editKeyId is in URL
  useEffect(() => {
    if (editKeyId && keys.length > 0 && !editingKey) {
      const keyToEdit = keys.find((k) => k.id === editKeyId)

      if (keyToEdit) {
        handleEdit(keyToEdit)
        // Clear the editKeyId from URL after handling
        pagination.updateUrlParams({ editKeyId: null })
      }
    }
  }, [editKeyId, keys, editingKey, pagination])

  // Filter update handlers
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchInput(query)
      // Only update URL if query is empty or has 3+ characters
      if (query.trim().length === 0 || query.trim().length >= 2) {
        pagination.updateUrlParams({ q: query.trim() || null, page: '1' })
      }
    },
    [pagination]
  )

  const handleTypeFilterChange = useCallback(
    (type: string | null) => {
      pagination.updateUrlParams({ keyType: type, page: '1' })
    },
    [pagination]
  )

  const handleDisposedFilterChange = useCallback(
    (disposed: string | null) => {
      pagination.updateUrlParams({ disposed, page: '1' })
    },
    [pagination]
  )

  const handleDatesChange = useCallback(
    (afterDate: string | null, beforeDate: string | null) => {
      pagination.updateUrlParams({
        createdAtAfter: afterDate,
        createdAtBefore: beforeDate,
        page: '1',
      })
    },
    [pagination]
  )

  const handleKeySystemSelect = useCallback(
    (keySystem: KeySystem | null) => {
      setSelectedKeySystem(keySystem)
      pagination.updateUrlParams({
        keySystemId: keySystem?.id || null,
        page: '1',
      })
    },
    [pagination]
  )

  const searchKeySystems = async (query: string): Promise<KeySystem[]> => {
    return await keySystemSearchService.search({
      q: query,
      fields: ['systemCode', 'name'],
    })
  }

  const handleAddNew = () => {
    if (showAddForm && !editingKey) {
      setShowAddForm(false)
    } else {
      setEditingKey(null)
      setShowAddForm(true)
    }
  }

  const handleEdit = (key: Key) => {
    setEditingKey(key)
    setShowAddForm(true)
    // Scroll to the edit form after a brief delay to ensure it's rendered
    setTimeout(() => {
      document.getElementById('edit-key-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
  }

  const handleSave = async (
    keyData: Omit<Key, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (editingKey) {
      try {
        // Check if flex number changed and if rentalObjectCode exists
        const flexChanged =
          keyData.flexNumber !== editingKey.flexNumber &&
          keyData.flexNumber !== undefined
        const rentalObjectCode =
          keyData.rentalObjectCode || editingKey.rentalObjectCode

        // If flex changed and we have a rental object, sync all keys
        if (flexChanged && rentalObjectCode && keyData.flexNumber) {
          // Validate flex is within bounds
          if (keyData.flexNumber < 1 || keyData.flexNumber > 3) {
            toast({
              title: 'Ogiltigt flex-nummer',
              description: 'Flex-nummer måste vara mellan 1 och 3.',
              variant: 'destructive',
            })
            return
          }

          try {
            await keyService.bulkUpdateFlex(
              rentalObjectCode,
              keyData.flexNumber
            )
          } catch (flexErr) {
            console.error('Failed to bulk update flex:', flexErr)
            toast({
              title: 'Kunde inte uppdatera flex',
              description:
                'Flex-numret kunde inte uppdateras för alla nycklar.',
              variant: 'destructive',
            })
            return
          }
        }

        const updated = await keyService.updateKey(editingKey.id, keyData)

        // Refetch keys if flex was changed to update all affected keys in the list
        if (flexChanged && rentalObjectCode) {
          await fetchKeys(pagination.currentPage, pagination.currentLimit)
        } else {
          setKeys((prev) =>
            prev.map((k) => (k.id === editingKey.id ? updated : k))
          )
        }

        toast({
          title: 'Nyckel uppdaterad',
          description: flexChanged
            ? `${updated.keyName ?? keyData.keyName} och alla nycklar på ${rentalObjectCode} har uppdaterats till flex ${keyData.flexNumber}.`
            : `${updated.keyName ?? keyData.keyName} har uppdaterats.`,
        })
        setShowAddForm(false)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Okänt fel vid uppdatering'
        toast({
          title: 'Kunde inte uppdatera nyckel',
          description: msg,
          variant: 'destructive',
        })
      }
      return
    }

    // Create
    try {
      const created = await keyService.createKey(keyData)
      setKeys((prev) => [...prev, created])
      // or await fetchKeys() if you prefer server ordering immediately
      toast({
        title: 'Nyckel tillagd',
        description: `${keyData.keyName} har lagts till.`,
      })
      setShowAddForm(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Okänt fel vid skapande'
      toast({
        title: 'Kunde inte skapa nyckel',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  const handleBatchSave = async (batch: {
    keys: Array<Omit<Key, 'id' | 'createdAt' | 'updatedAt'>>
    createEvent: boolean
  }) => {
    const createdKeyIds: string[] = []
    let failedCount = 0
    let eventCreated = false
    let eventFailed = false

    try {
      // Create all keys (best effort - continue on individual failures)
      for (const keyData of batch.keys) {
        try {
          const created = await keyService.createKey({
            ...keyData,
          })
          createdKeyIds.push(created.id)
          setKeys((prev) => [...prev, created])
        } catch (keyError) {
          console.error('Failed to create key:', keyError)
          failedCount++
          // Continue with remaining keys
        }
      }

      // Create ORDER event if requested and at least one key was created
      if (batch.createEvent && createdKeyIds.length > 0) {
        try {
          await keyEventService.createKeyOrder(createdKeyIds)
          eventCreated = true
        } catch (eventError) {
          console.error('Failed to create key order event:', eventError)
          eventFailed = true
        }
      }

      // Build success message based on outcomes
      if (createdKeyIds.length > 0) {
        const keyCount = createdKeyIds.length
        const isSingle = keyCount === 1

        let title = ''
        let description = ''
        let variant: 'default' | 'destructive' = 'default'

        // Determine title based on outcome
        if (failedCount > 0) {
          title = 'Delvis lyckades'
        } else if (eventCreated) {
          title = isSingle
            ? 'Nyckel tillagd och beställd'
            : 'Nycklar tillagda och beställda'
        } else {
          title = isSingle ? 'Nyckel tillagd' : 'Nycklar tillagda'
        }

        // Determine description - handle different combinations
        if (isSingle) {
          // Single key scenarios - keep it simple and natural
          if (failedCount > 0 && eventCreated) {
            description =
              'Nyckel har lagts till och extranyckel har beställts. 1 nyckel misslyckades att skapas.'
          } else if (failedCount > 0 && eventFailed) {
            description =
              'Nyckel har lagts till, men beställningen kunde inte registreras. 1 nyckel misslyckades att skapas.'
          } else if (failedCount > 0) {
            description = '1 nyckel skapad. 1 misslyckades.'
            variant = 'destructive'
          } else if (eventCreated) {
            description = 'Nyckel har lagts till och extranyckel har beställts.'
          } else if (eventFailed) {
            description =
              'Nyckel har lagts till, men beställningen kunde inte registreras. Kontakta support om du behöver spåra denna beställning.'
          } else {
            description = 'Nyckel har lagts till.'
          }
        } else {
          // Batch scenarios - include counts
          if (failedCount > 0 && eventCreated) {
            description = `${keyCount} nycklar har lagts till och extranycklar har beställts. ${failedCount} nycklar misslyckades att skapas.`
          } else if (failedCount > 0 && eventFailed) {
            description = `${keyCount} nycklar har lagts till, men beställningen kunde inte registreras. ${failedCount} nycklar misslyckades att skapas.`
          } else if (failedCount > 0) {
            description = `${keyCount} nycklar skapade. ${failedCount} misslyckades.`
            variant = 'destructive'
          } else if (eventCreated) {
            description = `${keyCount} nycklar har lagts till och extranycklar har beställts.`
          } else if (eventFailed) {
            description = `${keyCount} nycklar har lagts till, men beställningen kunde inte registreras. Kontakta support om du behöver spåra denna beställning.`
          } else {
            description = `${keyCount} nycklar har lagts till.`
          }
        }

        toast({ title, description, variant })
        setShowAddForm(false)
      } else {
        // All keys failed
        toast({
          title: 'Kunde inte skapa nycklar',
          description: 'Alla nycklar misslyckades att skapas.',
          variant: 'destructive',
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Okänt fel vid skapande'
      toast({
        title: 'Kunde inte skapa nycklar',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  const handleDelete = (keyId: string) => {
    const key = keys.find((k) => k.id === keyId)
    if (!key) return
    setDeletingKey(key)
  }

  const handleConfirmDelete = async () => {
    if (!deletingKey) return

    try {
      await keyService.deleteKey(deletingKey.id)
      setKeys((prev) => prev.filter((k) => k.id !== deletingKey.id))
      toast({
        title: 'Nyckel borttagen',
        description: `${deletingKey.keyName} har tagits bort.`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Okänt fel vid borttagning'
      toast({
        title: 'Kunde inte ta bort nyckel',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setDeletingKey(null)
    }
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingKey(null)
  }

  // Get selected keys as array
  const selectedKeys = useMemo(
    () => keys.filter((k) => keySelection.isSelected(k.id)),
    [keys, keySelection.selectedIds]
  )

  const NON_DELETABLE_KEY_TYPES = ['HN', 'FS']
  const hasNonDeletableSelected = selectedKeys.some((k) =>
    NON_DELETABLE_KEY_TYPES.includes(k.keyType)
  )

  // Bulk delete handler - check for active loans first
  const handleBulkDeleteClick = async () => {
    setBulkLoading(true)
    try {
      // Check which selected keys have active loans
      const keysWithLoans: Key[] = []

      for (const key of selectedKeys) {
        try {
          const loans = await keyLoanService.getByKeyId(key.id)
          const hasActiveLoan = loans.some((loan) => !loan.returnedAt)
          if (hasActiveLoan) {
            keysWithLoans.push(key)
          }
        } catch {
          // If we can't check, assume it's safe to delete
        }
      }

      setKeysWithActiveLoans(keysWithLoans)
      setShowBulkDeleteDialog(true)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    try {
      const result = await keyService.bulkDeleteKeys(keySelection.selectedIds)

      // Remove deleted keys from local state
      const deletedSet = new Set(keySelection.selectedIds)
      setKeys((prev) => prev.filter((k) => !deletedSet.has(k.id)))
      keySelection.deselectAll()
      setShowBulkDeleteDialog(false)

      toast({
        title: 'Nycklar borttagna',
        description: `${result} nycklar har tagits bort.`,
        variant: 'destructive',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Okänt fel vid borttagning'
      toast({
        title: 'Kunde inte ta bort nycklar',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  // Bulk edit handler
  const handleBulkEditConfirm = async (updates: {
    flexNumber?: number | null
    keySystemId?: string | null
    rentalObjectCode?: string
    disposed?: boolean
    notes?: string | null
    clearNotes?: boolean
  }) => {
    try {
      const result = await keyService.bulkUpdateKeys(
        keySelection.selectedIds,
        updates
      )

      // Refetch to get updated data
      await fetchKeys(pagination.currentPage, pagination.currentLimit)
      keySelection.deselectAll()
      setShowBulkEditForm(false)

      toast({
        title: 'Nycklar uppdaterade',
        description: `${result} nycklar har uppdaterats.`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Okänt fel vid uppdatering'
      toast({
        title: 'Kunde inte uppdatera nycklar',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  return (
    <ListPageLayout
      title="Nycklar"
      subtitle={`${keys.length} av ${pagination.paginationMeta.totalRecords} nycklar`}
      searchValue={searchInput}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Sök nycklar..."
      searchExtra={
        <SearchDropdown
          className="w-72"
          preSuggestions={[]}
          searchFn={searchKeySystems}
          minSearchLength={1}
          formatItem={(item: KeySystem) => ({
            primaryText: item.systemCode,
            secondaryText: item.name || undefined,
            searchableText: `${item.systemCode} ${item.name || ''}`,
          })}
          getKey={(item: KeySystem) => item.id}
          value={keySystemSearch}
          onChange={setKeySystemSearch}
          onSelect={handleKeySystemSelect}
          selectedValue={selectedKeySystem}
          placeholder="Filtrera på låssystem"
          showSearchIcon
        />
      }
      onAddNew={handleAddNew}
      addButtonLabel="Ny nyckel"
      pagination={pagination}
    >
      {showAddForm && (
        <div id="edit-key-form">
          <AddKeyForm
            onSave={handleSave}
            onBatchSave={handleBatchSave}
            onCancel={handleCancel}
            editingKey={editingKey}
          />
        </div>
      )}

      {showBulkEditForm && (
        <BulkEditKeysForm
          selectedCount={keySelection.selectedIds.length}
          onSave={handleBulkEditConfirm}
          onCancel={() => setShowBulkEditForm(false)}
        />
      )}

      {loading && (
        <div className="text-sm text-muted-foreground py-4">
          Hämtar nycklar…
        </div>
      )}
      {error && <div className="text-sm text-red-600 py-2">Fel: {error}</div>}

      <KeysTable
        keys={keys}
        keySystemMap={keySystemMap}
        onEdit={handleEdit}
        onDelete={handleDelete}
        selectedType={selectedTypeFilter}
        onTypeFilterChange={handleTypeFilterChange}
        selectedDisposed={selectedDisposedFilter}
        onDisposedFilterChange={handleDisposedFilterChange}
        createdAtAfter={createdAtAfter}
        createdAtBefore={createdAtBefore}
        onDatesChange={handleDatesChange}
        selection={keySelection}
      />

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={keySelection.selectedIds.length}
        onClear={() => keySelection.deselectAll()}
        isLoading={bulkLoading}
        actions={[
          {
            label: 'Redigera',
            icon: <Pencil className="mr-2 h-4 w-4" />,
            onClick: () => setShowBulkEditForm(true),
          },
          {
            label: hasNonDeletableSelected
              ? 'Ta bort (innehåller skyddade nycklar)'
              : 'Ta bort',
            icon: <Trash2 className="mr-2 h-4 w-4" />,
            onClick: handleBulkDeleteClick,
            variant: 'destructive',
            disabled: hasNonDeletableSelected,
          },
        ]}
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteKeysDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        selectedKeys={selectedKeys}
        keysWithActiveLoans={keysWithActiveLoans}
        onConfirm={handleBulkDeleteConfirm}
      />

      <ConfirmDialog
        open={!!deletingKey}
        onOpenChange={(open) => {
          if (!open) setDeletingKey(null)
        }}
        title="Ta bort nyckel"
        description={
          <p>
            Är du säker på att du vill ta bort nyckeln
            {deletingKey ? ` "${deletingKey.keyName}"` : ''}?
            <br />
            <br />
            <strong>
              Att radera innebär att all historik och data tas bort permanent.
            </strong>
            <br />
            Detta är inte samma sak som en kassering.
          </p>
        }
        confirmLabel="Ta bort"
        onConfirm={handleConfirmDelete}
      />
    </ListPageLayout>
  )
}

export default Index
