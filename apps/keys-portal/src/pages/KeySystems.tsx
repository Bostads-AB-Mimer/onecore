import { useState, useMemo, useEffect } from 'react'
import { KeySystemsHeader } from '@/components/key-systems/KeySystemsHeader'
import { KeySystemsToolbar } from '@/components/key-systems/KeySystemsToolbar'
import { KeySystemsTable } from '@/components/key-systems/KeySystemsTable'
import { AddKeySystemForm } from '@/components/key-systems/AddKeySystemForm'

import { KeySystem, Property } from '@/services/types'
import { useToast } from '@/hooks/use-toast'
import { keyService } from '@/services/api/keyService'
import { propertySearchService } from '@/services/api/propertySearchService'

export default function KeySystems() {
  const [KeySystems, setKeySystems] = useState<KeySystem[]>([])
  const [propertyMap, setPropertyMap] = useState<Map<string, Property>>(
    new Map()
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKeySystem, setEditingKeySystem] = useState<KeySystem | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Load key systems and their properties from API on mount
  useEffect(() => {
    const loadKeySystems = async () => {
      try {
        setIsLoading(true)
        const systems = await keyService.getAllKeySystems()
        setKeySystems(systems)

        // Collect all unique property IDs from all key systems
        const allPropertyIds = new Set<string>()
        systems.forEach((system) => {
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
    }
    loadKeySystems()
  }, [])

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

  return (
    <div className="container mx-auto py-8 px-4">
      <KeySystemsHeader
        totalKeySystems={KeySystems.length}
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
      />
    </div>
  )
}
