import { useState, useMemo, useEffect, useCallback } from 'react'
import { KeySystemsHeader } from '@/components/key-systems/KeySystemsHeader'
import { KeySystemsToolbar } from '@/components/key-systems/KeySystemsToolbar'
import { KeySystemsTable } from '@/components/key-systems/KeySystemsTable'
import { AddKeySystemForm } from '@/components/key-systems/AddKeySystemForm'
import { PaginationControls } from '@/components/common/PaginationControls'

import { KeySystem, Property, Key } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import { keyService } from '@/services/api/keyService'
import { propertySearchService } from '@/services/api/propertySearchService'
import { usePagination } from '@/hooks/usePagination'

export default function KeySystems() {
  const [KeySystems, setKeySystems] = useState<KeySystem[]>([])
  const [propertyMap, setPropertyMap] = useState<Map<string, Property>>(
    new Map()
  )
  const [searchQuery, setSearchQuery] = useState('')
  // Column filters (for table header dropdowns)
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(
    null
  )
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    string | null
  >(null)
  const [installationDateAfter, setInstallationDateAfter] = useState<
    string | null
  >(null)
  const [installationDateBefore, setInstallationDateBefore] = useState<
    string | null
  >(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKeySystem, setEditingKeySystem] = useState<KeySystem | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSystemId, setExpandedSystemId] = useState<string | null>(null)
  const [keysForExpandedSystem, setKeysForExpandedSystem] = useState<Key[]>([])
  const [isLoadingKeys, setIsLoadingKeys] = useState(false)
  const { toast } = useToast()

  const pagination = usePagination({
    initialLimit: 60,
    onPageChange: (page, limit) => loadKeySystems(page, limit),
  })

  // Load key systems and their properties from API
  const loadKeySystems = useCallback(
    async (page: number = 1, limit: number = 60) => {
      try {
        setIsLoading(true)

        // Build search parameters based on current filters
        const searchParams: Record<string, string | string[]> = {}

        // Add search query if present
        if (searchQuery.trim().length >= 3) {
          searchParams.q = searchQuery.trim()
          searchParams.fields = 'systemCode,name,manufacturer'
        }

        // Add type filter from column header
        if (selectedTypeFilter) {
          searchParams.type = selectedTypeFilter
        }

        // Add status filter from column header
        if (selectedStatusFilter) {
          searchParams.isActive = selectedStatusFilter
        }

        // Add installation date filters (can be both at the same time)
        const dateFilters: string[] = []
        if (installationDateAfter) {
          dateFilters.push(`>=${installationDateAfter}`)
        }
        if (installationDateBefore) {
          dateFilters.push(`<=${installationDateBefore}`)
        }
        if (dateFilters.length > 0) {
          searchParams.installationDate =
            dateFilters.length === 1 ? dateFilters[0] : dateFilters
        }

        // Use search endpoint if filtering/searching, otherwise use getAllKeySystems
        const hasFilters = Object.keys(searchParams).length > 0
        const response = hasFilters
          ? await keyService.searchKeySystems(searchParams, page, limit)
          : await keyService.getAllKeySystems(page, limit)

        setKeySystems(response.content)
        pagination.setPaginationMeta(response._meta)

        // Collect all unique property IDs from all key systems
        const allPropertyIds = new Set<string>()
        response.content.forEach((system) => {
          if (system.propertyIds) {
            try {
              const ids =
                typeof system.propertyIds === 'string'
                  ? JSON.parse(system.propertyIds)
                  : system.propertyIds
              if (Array.isArray(ids)) {
                ids.forEach((id: string) => allPropertyIds.add(id))
              }
            } catch (e) {
              console.error('Failed to parse propertyIds:', e)
            }
          }
        })

        // Fetch all properties at once
        if (allPropertyIds.size > 0) {
          const properties = await propertySearchService.getByIds(
            Array.from(allPropertyIds)
          )
          const newPropertyMap = new Map<string, Property>()
          properties.forEach((prop) => newPropertyMap.set(prop.id, prop))
          setPropertyMap(newPropertyMap)
        }
      } catch (error) {
        console.error('Failed to load key systems:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ladda låssystem.',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    },
    [
      toast,
      pagination,
      searchQuery,
      selectedTypeFilter,
      selectedStatusFilter,
      installationDateAfter,
      installationDateBefore,
    ]
  )

  useEffect(() => {
    // Reset to page 1 and fetch when search/filter changes
    pagination.handlePageChange(1)
  }, [
    searchQuery,
    selectedTypeFilter,
    selectedStatusFilter,
    installationDateAfter,
    installationDateBefore,
  ])

  const handleAddNew = () => {
    if (showAddForm && !editingKeySystem) {
      // If form is already open for adding new (not editing), close it
      setShowAddForm(false)
    } else {
      // Otherwise open form for adding new
      setEditingKeySystem(null)
      setShowAddForm(true)
    }
  }

  const handleEdit = (KeySystem: KeySystem) => {
    setEditingKeySystem(KeySystem)
    setShowAddForm(true)
  }

  const handleSave = async (
    KeySystemData: Omit<KeySystem, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      if (editingKeySystem) {
        // Update existing key system
        const updated = await keyService.updateKeySystem(
          editingKeySystem.id,
          KeySystemData
        )
        setKeySystems((prev) =>
          prev.map((ls) => (ls.id === editingKeySystem.id ? updated : ls))
        )
        toast({
          title: 'Låssystem uppdaterat',
          description: `${KeySystemData.name} har uppdaterats framgångsrikt.`,
        })
      } else {
        // Create new key system
        const newKeySystem = await keyService.createKeySystem(KeySystemData)
        setKeySystems((prev) => [...prev, newKeySystem])
        toast({
          title: 'Låssystem skapat',
          description: `${KeySystemData.name} har skapats framgångsrikt.`,
        })
      }
      setShowAddForm(false)
    } catch (error: any) {
      console.error('Failed to save key system:', error)

      // Check if it's a conflict error (409)
      const isConflict =
        error?.status === 409 ||
        error?.message?.includes('409') ||
        error?.message?.includes('already exists')

      toast({
        title: 'Fel',
        description: isConflict
          ? 'Ett låssystem med denna systemkod finns redan.'
          : error?.message || 'Kunde inte spara låssystemet.',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingKeySystem(null)
  }

  const handleDelete = async (id: string) => {
    const KeySystem = KeySystems.find((ls) => ls.id === id)
    if (!KeySystem) return

    try {
      await keyService.deleteKeySystem(id)
      setKeySystems((prev) => prev.filter((ls) => ls.id !== id))
      toast({
        title: 'Låssystem borttaget',
        description: `${KeySystem.name} har tagits bort.`,
        variant: 'destructive',
      })
    } catch (error) {
      console.error('Failed to delete key system:', error)
      toast({
        title: 'Fel',
        description: 'Kunde inte ta bort låssystemet.',
        variant: 'destructive',
      })
    }
  }

  const handleToggleExpand = async (systemId: string) => {
    if (expandedSystemId === systemId) {
      // Collapse if already expanded
      setExpandedSystemId(null)
      setKeysForExpandedSystem([])
    } else {
      // Expand and load keys
      setExpandedSystemId(systemId)
      setIsLoadingKeys(true)
      try {
        const response = await keyService.getAllKeys(1, 1000) // Get up to 1000 keys for this system
        // Filter keys that belong to this key system
        const filteredKeys = response.content.filter(
          (key) => key.keySystemId === systemId
        )
        setKeysForExpandedSystem(filteredKeys)
      } catch (error) {
        console.error('Failed to load keys:', error)
        toast({
          title: 'Fel',
          description: 'Kunde inte ladda nycklar för detta låssystem.',
          variant: 'destructive',
        })
        setKeysForExpandedSystem([])
      } finally {
        setIsLoadingKeys(false)
      }
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <KeySystemsHeader
        totalKeySystems={pagination.paginationMeta.totalRecords}
        displayedKeySystems={KeySystems.length}
      />

      <KeySystemsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddNew={handleAddNew}
      />

      {showAddForm && (
        <AddKeySystemForm
          onSave={handleSave}
          onCancel={handleCancel}
          editingKeySystem={editingKeySystem}
        />
      )}

      <KeySystemsTable
        KeySystems={KeySystems}
        propertyMap={propertyMap}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onExplore={() => {}} // No longer used, navigation handled in table
        expandedSystemId={expandedSystemId}
        onToggleExpand={handleToggleExpand}
        keysForExpandedSystem={keysForExpandedSystem}
        isLoadingKeys={isLoadingKeys}
        selectedType={selectedTypeFilter}
        onTypeFilterChange={setSelectedTypeFilter}
        selectedStatus={selectedStatusFilter}
        onStatusFilterChange={setSelectedStatusFilter}
        installationDateAfter={installationDateAfter}
        installationDateBefore={installationDateBefore}
        onInstallationDateAfterChange={setInstallationDateAfter}
        onInstallationDateBeforeChange={setInstallationDateBefore}
      />

      <PaginationControls
        paginationMeta={pagination.paginationMeta}
        pageLimit={pagination.pageLimit}
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
