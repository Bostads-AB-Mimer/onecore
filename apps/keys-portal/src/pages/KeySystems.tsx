import { useState, useMemo, useEffect, useCallback } from 'react'
import { KeySystemsHeader } from '@/components/key-systems/KeySystemsHeader'
import { KeySystemsToolbar } from '@/components/key-systems/KeySystemsToolbar'
import { KeySystemsTable } from '@/components/key-systems/KeySystemsTable'
import { AddKeySystemForm } from '@/components/key-systems/AddKeySystemForm'

import { KeySystem, Property, Key } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import { keyService, type PaginationMeta } from '@/services/api/keyService'
import { propertySearchService } from '@/services/api/propertySearchService'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function KeySystems() {
  const [KeySystems, setKeySystems] = useState<KeySystem[]>([])
  const [propertyMap, setPropertyMap] = useState<Map<string, Property>>(
    new Map()
  )
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    totalRecords: 0,
    page: 1,
    limit: 60,
    count: 0,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKeySystem, setEditingKeySystem] = useState<KeySystem | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSystemId, setExpandedSystemId] = useState<string | null>(null)
  const [keysForExpandedSystem, setKeysForExpandedSystem] = useState<Key[]>([])
  const [isLoadingKeys, setIsLoadingKeys] = useState(false)
  const [pageLimit, setPageLimit] = useState<number>(60)
  const [customLimit, setCustomLimit] = useState<string>('')
  const [isFocused, setIsFocused] = useState(false)
  const { toast } = useToast()

  // Load key systems and their properties from API
  const loadKeySystems = useCallback(
    async (page: number = 1, limit: number = pageLimit) => {
      try {
        setIsLoading(true)
        const response = await keyService.getAllKeySystems(page, limit)
        setKeySystems(response.content)
        setPaginationMeta(response._meta)

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
    [toast, pageLimit]
  )

  useEffect(() => {
    loadKeySystems()
  }, [loadKeySystems])

  const filteredKeySystems = useMemo(() => {
    return KeySystems.filter((KeySystem) => {
      // Skip undefined/null entries that may have been added from failed API calls
      if (!KeySystem) return false

      const matchesSearch =
        (KeySystem.systemCode || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (KeySystem.name || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (KeySystem.manufacturer &&
          KeySystem.manufacturer
            .toLowerCase()
            .includes(searchQuery.toLowerCase()))

      const matchesType =
        selectedType === 'all' || KeySystem.type === selectedType

      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && KeySystem.isActive) ||
        (selectedStatus === 'inactive' && !KeySystem.isActive)

      return matchesSearch && matchesType && matchesStatus
    })
  }, [KeySystems, searchQuery, selectedType, selectedStatus])

  const handlePageChange = (newPage: number) => {
    loadKeySystems(newPage, pageLimit)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLimitChange = (newLimit: number) => {
    setPageLimit(newLimit)
    loadKeySystems(1, newLimit)
  }

  const handleCustomLimitSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const parsed = parseInt(customLimit)
      if (parsed > 0) {
        setPageLimit(parsed)
        setCustomLimit('')
        loadKeySystems(1, parsed)
        e.currentTarget.blur()
      }
    }
  }

  const totalPages = Math.ceil(paginationMeta.totalRecords / paginationMeta.limit)
  const currentPage = paginationMeta.page

  const handleAddNew = () => {
    setEditingKeySystem(null)
    setShowAddForm(true)
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
        const filteredKeys = response.content.filter((key) => key.keySystemId === systemId)
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
        totalKeySystems={paginationMeta.totalRecords}
        displayedKeySystems={filteredKeySystems.length}
      />

      <KeySystemsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
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
        KeySystems={filteredKeySystems}
        propertyMap={propertyMap}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onExplore={() => {}} // No longer used, navigation handled in table
        expandedSystemId={expandedSystemId}
        onToggleExpand={handleToggleExpand}
        keysForExpandedSystem={keysForExpandedSystem}
        isLoadingKeys={isLoadingKeys}
      />

      <div className="mt-8 space-y-4">
        <div className="relative flex items-center justify-center">
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(currentPage - 1)}
                    className={
                      currentPage <= 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>

              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1
                // Show first page, last page, current page, and pages around current
                const showPage =
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  Math.abs(pageNum - currentPage) <= 1

                if (!showPage) {
                  // Show ellipsis for gaps
                  if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                  }
                  return null
                }

                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => handlePageChange(pageNum)}
                      isActive={pageNum === currentPage}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(currentPage + 1)}
                    className={
                      currentPage >= totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}

          <div className="absolute right-0 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Items per page:</span>
            <Button
              variant={pageLimit === 60 ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleLimitChange(60)}
            >
              60
            </Button>
            <Button
              variant={pageLimit === 100 ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleLimitChange(100)}
            >
              100
            </Button>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={!isFocused && pageLimit !== 60 && pageLimit !== 100 && customLimit === '' ? pageLimit.toString() : customLimit}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '')
                setCustomLimit(val)
              }}
              onFocus={(e) => {
                setIsFocused(true)
                if (pageLimit !== 60 && pageLimit !== 100 && customLimit === '') {
                  setCustomLimit(pageLimit.toString())
                }
              }}
              onBlur={() => {
                setIsFocused(false)
              }}
              onKeyDown={handleCustomLimitSubmit}
              placeholder="Antal"
              className={`w-24 h-8 px-3 text-xs font-medium text-center rounded-md ${pageLimit !== 60 && pageLimit !== 100 ? 'bg-primary text-primary-foreground placeholder:text-primary-foreground/70 border-primary shadow focus-visible:ring-0 focus-visible:ring-offset-0' : ''}`}
            />
          </div>
        </div>

        {paginationMeta.totalRecords > 0 && (
          <div className="flex justify-center">
            <span className="text-sm text-muted-foreground">
              {((paginationMeta.page - 1) * paginationMeta.limit) + 1}-
              {Math.min(paginationMeta.page * paginationMeta.limit, paginationMeta.totalRecords)} of {paginationMeta.totalRecords}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
