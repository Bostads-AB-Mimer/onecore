import { useState, useEffect, useCallback } from 'react'
import { KeysHeader } from '@/components/keys/KeysHeader'
import { KeysToolbar } from '@/components/keys/KeysToolbar'
import { KeysTable } from '@/components/keys/KeysTable'
import { AddKeyForm } from '@/components/keys/AddKeyForm'
import { PaginationControls } from '@/components/common/PaginationControls'
import { useToast } from '@/hooks/use-toast'
import { useUrlPagination } from '@/hooks/useUrlPagination'
import { Key } from '@/services/types'
import { keyService } from '@/services/api/keyService'

const Index = () => {
  const pagination = useUrlPagination()
  const [keys, setKeys] = useState<Key[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [keySystemMap, setKeySystemMap] = useState<Record<string, string>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKey, setEditingKey] = useState<Key | null>(null)
  const { toast } = useToast()

  // Read all filters from URL
  const searchQuery = pagination.searchParams.get('q') || ''
  const selectedTypeFilter = pagination.searchParams.get('keyType') || null
  const createdAtAfter = pagination.searchParams.get('createdAtAfter') || null
  const createdAtBefore = pagination.searchParams.get('createdAtBefore') || null

  // Local state for search input (to allow typing without triggering URL changes)
  const [searchInput, setSearchInput] = useState(searchQuery)

  const fetchKeys = useCallback(
    async (page: number = 1, limit: number = 60) => {
      setLoading(true)
      setError('')
      try {
        // Build search parameters based on current filters
        const searchParams: Record<string, string | string[]> = {}

        // Add search query if present
        if (searchQuery.trim().length >= 3) {
          searchParams.q = searchQuery.trim()
          searchParams.fields = 'keyName,rentalObjectCode,keySystemId'
        }

        // Add column filters
        if (selectedTypeFilter) {
          searchParams.keyType = selectedTypeFilter
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
        const hasFilters = Object.keys(searchParams).length > 0
        const response = hasFilters
          ? await keyService.searchKeys(searchParams, page, limit)
          : await keyService.getAllKeys(page, limit)

        setKeys(response.content)
        pagination.setPaginationMeta(response._meta)

        // Fetch key systems for keys that have a keySystemId
        const uniqueKeySystemIds = [
          ...new Set(
            response.content
              .map((k) => k.keySystemId)
              .filter((id): id is string => id != null && id !== '')
          ),
        ]

        if (uniqueKeySystemIds.length > 0) {
          const systemMap: Record<string, string> = {}
          await Promise.all(
            uniqueKeySystemIds.map(async (id) => {
              try {
                const keySystem = await keyService.getKeySystem(id)
                systemMap[id] = keySystem.systemCode
              } catch (error) {
                console.error(`Failed to fetch key system ${id}:`, error)
              }
            })
          )
          setKeySystemMap(systemMap)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Okänt fel'
        setError(msg)
        toast({
          title: 'Kunde inte hämta nycklar',
          description: msg,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    },
    [
      searchQuery,
      selectedTypeFilter,
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
    createdAtAfter,
    createdAtBefore,
    // fetchKeys intentionally omitted to prevent infinite loop
  ])

  // Sync search input with URL when URL changes
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  // Filter update handlers
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchInput(query)
      // Only update URL if query is empty or has 3+ characters
      if (query.trim().length === 0 || query.trim().length >= 3) {
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
  }

  const handleSave = async (
    keyData: Omit<Key, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (editingKey) {
      try {
        const updated = await keyService.updateKey(editingKey.id, keyData)
        setKeys((prev) =>
          prev.map((k) => (k.id === editingKey.id ? updated : k))
        )
        toast({
          title: 'Nyckel uppdaterad',
          description: `${updated.keyName ?? keyData.keyName} har uppdaterats.`,
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

  const handleDelete = async (keyId: string) => {
    const key = keys.find((k) => k.id === keyId)
    if (!key) return

    try {
      await keyService.deleteKey(keyId)
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
      toast({
        title: 'Nyckel borttagen',
        description: `${key.keyName} har tagits bort.`,
        variant: 'destructive',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Okänt fel vid borttagning'
      toast({
        title: 'Kunde inte ta bort nyckel',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingKey(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <KeysHeader
          totalKeys={pagination.paginationMeta.totalRecords}
          displayedKeys={keys.length}
        />

        <KeysToolbar
          searchQuery={searchInput}
          onSearchChange={handleSearchChange}
          onAddNew={handleAddNew}
        />

        {showAddForm && (
          <AddKeyForm
            onSave={handleSave}
            onCancel={handleCancel}
            editingKey={editingKey}
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
          createdAtAfter={createdAtAfter}
          createdAtBefore={createdAtBefore}
          onDatesChange={handleDatesChange}
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
    </div>
  )
}

export default Index
