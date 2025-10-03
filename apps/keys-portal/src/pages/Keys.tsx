import { useState, useMemo, useEffect, useCallback } from 'react'
import { KeysHeader } from '@/components/keys/KeysHeader'
import { KeysToolbar } from '@/components/keys/KeysToolbar'
import { KeysTable } from '@/components/keys/KeysTable'
import { AddKeyForm } from '@/components/keys/AddKeyForm'
import { useToast } from '@/hooks/use-toast'
import { Key } from '@/services/types'
import { keyService, type PaginationMeta } from '@/services/api/keyService'
import type { components } from '@/services/api/generated/api-types'
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
  keySystemId: k.keySystemId ?? undefined,
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
  const [keySystemMap, setKeySystemMap] = useState<Record<string, string>>({})
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    totalRecords: 0,
    page: 1,
    limit: 60,
    count: 0,
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingKey, setEditingKey] = useState<Key | null>(null)
  const [pageLimit, setPageLimit] = useState<number>(60)
  const [customLimit, setCustomLimit] = useState<string>('')
  const [isFocused, setIsFocused] = useState(false)
  const { toast } = useToast()

  const fetchKeys = useCallback(
    async (page: number = 1, limit: number = pageLimit) => {
      setLoading(true)
      setError('')
      try {
        const response = await keyService.getAllKeys(page, limit)
        const mappedKeys = response.content.map(toUIKey)
        setKeys(mappedKeys)
        setPaginationMeta(response._meta)

        // Fetch key systems for keys that have a keySystemId
        const uniqueKeySystemIds = [
          ...new Set(
            mappedKeys
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
    [toast, pageLimit]
  )

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

  const handlePageChange = (newPage: number) => {
    fetchKeys(newPage, pageLimit)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLimitChange = (newLimit: number) => {
    setPageLimit(newLimit)
    fetchKeys(1, newLimit)
  }

  const handleCustomLimitSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const parsed = parseInt(customLimit)
      if (parsed > 0) {
        setPageLimit(parsed)
        setCustomLimit('')
        fetchKeys(1, parsed)
        e.currentTarget.blur()
      }
    }
  }

  const totalPages = Math.ceil(paginationMeta.totalRecords / paginationMeta.limit)
  const currentPage = paginationMeta.page

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
          totalKeys={paginationMeta.totalRecords}
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
    </div>
  )
}

export default Index
