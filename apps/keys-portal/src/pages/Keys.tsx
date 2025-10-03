import { useState, useMemo, useEffect, useCallback } from 'react'
import { KeysHeader } from '@/components/keys/KeysHeader'
import { KeysToolbar } from '@/components/keys/KeysToolbar'
import { KeysTable } from '@/components/keys/KeysTable'
import { AddKeyForm } from '@/components/keys/AddKeyForm'
import { PaginationControls } from '@/components/common/PaginationControls'
import { useToast } from '@/hooks/use-toast'
import { Key } from '@/services/types'
import { keyService } from '@/services/api/keyService'
import { usePagination } from '@/hooks/usePagination'

const Index = () => {
  const [keys, setKeys] = useState<Key[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [keySystemMap, setKeySystemMap] = useState<Record<string, string>>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKey, setEditingKey] = useState<Key | null>(null)
  const { toast } = useToast()

  const pagination = usePagination({
    initialLimit: 60,
    onPageChange: (page, limit) => fetchKeys(page, limit),
  })

  const fetchKeys = useCallback(
    async (page: number = 1, limit: number = 60) => {
      setLoading(true)
      setError('')
      try {
        const response = await keyService.getAllKeys(page, limit)
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
    [toast, pagination]
  )

  useEffect(() => {
    fetchKeys()
  }, [])

  const filteredKeys = useMemo(() => {
    return keys.filter((key) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        key.keyName.toLowerCase().includes(q) ||
        key.rentalObjectCode?.toLowerCase().includes(q) ||
        key.keySystemId?.toLowerCase().includes(q)

      const matchesType = selectedType === 'all' || key.keyType === selectedType

      return matchesSearch && matchesType
    })
  }, [keys, searchQuery, selectedType])

  const handleAddNew = () => {
    setEditingKey(null)
    setShowAddForm(true)
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
          displayedKeys={filteredKeys.length}
        />

        <KeysToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
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
          keys={filteredKeys}
          keySystemMap={keySystemMap}
          onEdit={handleEdit}
          onDelete={handleDelete}
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
    </div>
  )
}

export default Index
