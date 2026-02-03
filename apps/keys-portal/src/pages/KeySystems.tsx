import { useState, useEffect, useCallback } from 'react'
import { ListPageLayout } from '@/components/shared/layout'
import { KeySystemsTable } from '@/components/key-systems/KeySystemsTable'
import { AddKeySystemForm } from '@/components/key-systems/AddKeySystemForm'

import { KeySystem, Property, Key } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import { keyService } from '@/services/api/keyService'
import { propertySearchService } from '@/services/api/propertySearchService'
import { keySystemSchemaService } from '@/services/api/keySystemSchemaService'
import { useUrlPagination } from '@/hooks/useUrlPagination'

export default function KeySystems() {
  const pagination = useUrlPagination()
  const [KeySystems, setKeySystems] = useState<KeySystem[]>([])
  const [propertyMap, setPropertyMap] = useState<Map<string, Property>>(
    new Map()
  )
  const [isLoading, setIsLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKeySystem, setEditingKeySystem] = useState<KeySystem | null>(
    null
  )
  const [expandedSystemId, setExpandedSystemId] = useState<string | null>(null)
  const [keysForExpandedSystem, setKeysForExpandedSystem] = useState<Key[]>([])
  const [isLoadingKeys, setIsLoadingKeys] = useState(false)
  const [uploadingSchemaId, setUploadingSchemaId] = useState<string | null>(
    null
  )
  const { toast } = useToast()

  // Read all filters from URL
  const searchQuery = pagination.searchParams.get('q') || ''
  const selectedTypeFilter = pagination.searchParams.get('type') || null
  const selectedStatusFilter = pagination.searchParams.get('isActive') || null
  const installationDateAfter =
    pagination.searchParams.get('installationDateAfter') || null
  const installationDateBefore =
    pagination.searchParams.get('installationDateBefore') || null

  // Local state for search input (to allow typing without triggering URL changes)
  const [searchInput, setSearchInput] = useState(searchQuery)

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
      searchQuery,
      selectedTypeFilter,
      selectedStatusFilter,
      installationDateAfter,
      installationDateBefore,
      toast,
      pagination.setPaginationMeta,
    ]
  )

  // Fetch data whenever URL params change
  useEffect(() => {
    loadKeySystems(pagination.currentPage, pagination.currentLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.currentPage,
    pagination.currentLimit,
    searchQuery,
    selectedTypeFilter,
    selectedStatusFilter,
    installationDateAfter,
    installationDateBefore,
    // loadKeySystems intentionally omitted to prevent infinite loop
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
      pagination.updateUrlParams({ type: type, page: '1' })
    },
    [pagination]
  )

  const handleStatusFilterChange = useCallback(
    (status: string | null) => {
      pagination.updateUrlParams({ isActive: status, page: '1' })
    },
    [pagination]
  )

  const handleInstallationDatesChange = useCallback(
    (afterDate: string | null, beforeDate: string | null) => {
      pagination.updateUrlParams({
        installationDateAfter: afterDate,
        installationDateBefore: beforeDate,
        page: '1',
      })
    },
    [pagination]
  )

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
    KeySystemData: Omit<KeySystem, 'id' | 'createdAt' | 'updatedAt'>,
    schemaFile?: File | null
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

        // Upload schema file if one was selected
        if (schemaFile) {
          try {
            await keySystemSchemaService.uploadFile(newKeySystem.id, schemaFile)

            // Fetch the updated key system with schemaFileId to sync UI
            const updatedKeySystem = await keyService.getKeySystem(
              newKeySystem.id
            )
            setKeySystems((prev) =>
              prev.map((ls) =>
                ls.id === newKeySystem.id ? updatedKeySystem : ls
              )
            )

            toast({
              title: 'Låssystem och schema skapat',
              description: `${KeySystemData.name} och dess schema har skapats framgångsrikt.`,
            })
          } catch (uploadError) {
            console.error('Failed to upload schema:', uploadError)
            toast({
              title: 'Låssystem skapat, men schema misslyckades',
              description: `${KeySystemData.name} har skapats, men schemat kunde inte laddas upp. Du kan försöka igen genom att redigera låssystemet.`,
              variant: 'destructive',
            })
          }
        } else {
          toast({
            title: 'Låssystem skapat',
            description: `${KeySystemData.name} har skapats framgångsrikt.`,
          })
        }
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
          (key) => key.keySystemId === systemId && !key.disposed
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

  const handleSchemaUpload = async (keySystemId: string, file: File) => {
    setUploadingSchemaId(keySystemId)
    try {
      await keySystemSchemaService.uploadFile(keySystemId, file)
      toast({
        title: 'Framgång',
        description: 'Schema uppladdad.',
      })
      // Refresh the key systems list to show the new schema
      await loadKeySystems(pagination.currentPage, pagination.currentLimit)
    } catch (error) {
      console.error('Failed to upload schema:', error)
      toast({
        title: 'Fel',
        description: 'Kunde inte ladda upp schema.',
        variant: 'destructive',
      })
    } finally {
      setUploadingSchemaId(null)
    }
  }

  const handleSchemaDownload = async (keySystemId: string) => {
    try {
      await keySystemSchemaService.downloadFile(keySystemId)
    } catch (error) {
      console.error('Failed to download schema:', error)
      toast({
        title: 'Fel',
        description: 'Kunde inte ladda ner schema.',
        variant: 'destructive',
      })
    }
  }

  const handleSchemaDelete = async (keySystemId: string) => {
    try {
      await keySystemSchemaService.deleteFile(keySystemId)
      toast({
        title: 'Framgång',
        description: 'Schema raderad.',
      })
      // Refresh the key systems list
      await loadKeySystems(pagination.currentPage, pagination.currentLimit)
    } catch (error) {
      console.error('Failed to delete schema:', error)
      toast({
        title: 'Fel',
        description: 'Kunde inte radera schema.',
        variant: 'destructive',
      })
    }
  }

  return (
    <ListPageLayout
      title="Låssystem"
      subtitle={`${KeySystems.length} av ${pagination.paginationMeta.totalRecords} låssystem`}
      searchValue={searchInput}
      onSearchChange={handleSearchChange}
      searchPlaceholder="Sök låssystem..."
      onAddNew={handleAddNew}
      addButtonLabel="Nytt låssystem"
      pagination={pagination}
    >
      {showAddForm && (
        <AddKeySystemForm
          onSave={handleSave}
          onCancel={handleCancel}
          editingKeySystem={editingKeySystem}
          onSchemaUpload={handleSchemaUpload}
          onSchemaDownload={handleSchemaDownload}
          onSchemaDelete={handleSchemaDelete}
        />
      )}

      <KeySystemsTable
        KeySystems={KeySystems}
        propertyMap={propertyMap}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onExplore={() => {}}
        expandedSystemId={expandedSystemId}
        onToggleExpand={handleToggleExpand}
        keysForExpandedSystem={keysForExpandedSystem}
        isLoadingKeys={isLoadingKeys}
        selectedType={selectedTypeFilter}
        onTypeFilterChange={handleTypeFilterChange}
        selectedStatus={selectedStatusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        installationDateAfter={installationDateAfter}
        installationDateBefore={installationDateBefore}
        onDatesChange={handleInstallationDatesChange}
        onSchemaUpload={handleSchemaUpload}
        onSchemaDownload={handleSchemaDownload}
        uploadingSchemaId={uploadingSchemaId}
      />
    </ListPageLayout>
  )
}
