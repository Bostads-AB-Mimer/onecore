import { useState, useMemo, useEffect, useCallback } from 'react'
import { KeysHeader } from '@/components/keys/KeysHeader'
import { KeysToolbar } from '@/components/keys/KeysToolbar'
import { KeysTable } from '@/components/keys/KeysTable'
import { AddKeyForm } from '@/components/keys/AddKeyForm'
import { useToast } from '@/hooks/use-toast'
import { Key } from '@/services/types'
import { keyService } from '@/services/api/keyService'
import type { components } from '@/services/api/generated/api-types'

type KeyDto = components['schemas']['Key']
type CreateKeyRequest = components['schemas']['CreateKeyRequest']
type UpdateKeyRequest = components['schemas']['UpdateKeyRequest']

const toUIKey = (k: KeyDto): Key => ({
  id: k.id ?? '',
  keyName: k.keyName ?? '',
  keySequenceNumber: k.keySequenceNumber,
  flexNumber: k.flexNumber,
  rentalObjectCode: k.rentalObjectCode,
  keyType: k.keyType as Key['keyType'],
  // API gives key_system_id; your UI type has keySystemName (optional).
  keySystemId: undefined,
  createdAt: k.createdAt,
  updatedAt: k.updatedAt,
})

const toCreateReq = (
  k: Omit<Key, 'id' | 'createdAt' | 'updatedAt'>
): CreateKeyRequest => ({
  keyName: k.keyName,
  keySequenceNumber: k.keySequenceNumber,
  flexNumber: k.flexNumber,
  rentalObjectCode: k.rentalObjectCode,
  keyType: k.keyType,
  keySystemId: k.keySystemId,
})

const toUpdateReq = (
  before: Key,
  after: Omit<Key, 'id' | 'createdAt' | 'updatedAt'>
): UpdateKeyRequest => {
  const payload: UpdateKeyRequest = {}
  if (before.keyName !== after.keyName) payload.keyName = after.keyName
  if (before.keySequenceNumber !== after.keySequenceNumber)
    payload.keySequenceNumber = after.keySequenceNumber
  if (before.flexNumber !== after.flexNumber)
    payload.flexNumber = after.flexNumber
  if (before.rentalObjectCode !== after.rentalObjectCode)
    payload.rentalObjectCode = after.rentalObjectCode
  if (before.keyType !== after.keyType) payload.keyType = after.keyType
  // if (before.key_system_id !== mappedId) payload.key_system_id = mappedId ?? null;
  return payload
}

const Index = () => {
  const [keys, setKeys] = useState<Key[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKey, setEditingKey] = useState<Key | null>(null)
  const { toast } = useToast()

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await keyService.getAllKeys()
      setKeys(list.map(toUIKey))
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
  }, [toast])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

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
        const payload = toUpdateReq(editingKey, keyData)
        if (Object.keys(payload).length === 0) {
          setShowAddForm(false)
          return
        }
        const updated = await keyService.updateKey(editingKey.id, payload)
        setKeys((prev) =>
          prev.map((k) => (k.id === editingKey.id ? toUIKey(updated) : k))
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
      const created = await keyService.createKey(toCreateReq(keyData))
      setKeys((prev) => [...prev, toUIKey(created)])
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
          totalKeys={keys.length}
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
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}

export default Index
