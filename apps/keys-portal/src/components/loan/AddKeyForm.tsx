import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Minus, Trash2 } from 'lucide-react'
import type { Key, KeyType, KeySystem } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { keyService } from '@/services/api/keyService'
import { keyEventService } from '@/services/api/keyEventService'
import { keySystemSearchService } from '@/services/api/keySystemSearchService'
import { SearchDropdown } from '@/components/ui/search-dropdown'
import { useToast } from '@/hooks/use-toast'

type AddKeyButtonProps = {
  onClick: () => void
  disabled?: boolean
}

export function AddKeyButton({ onClick, disabled = false }: AddKeyButtonProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1"
    >
      <Plus className="h-3 w-3" />
      Lägg till ny nyckel
    </Button>
  )
}

type KeyRow = {
  id: string
  keyType: KeyType
  keyName: string
  flexNumber: number | null
  quantity: number
  startingSequenceNumber: number
  keySystemId?: string
}

type Props = {
  keys: Key[]
  selectedKeyIds?: string[]
  rentalObjectCode: string
  onComplete: () => void
  onCancel: () => void
}

export function AddKeyForm({
  keys,
  selectedKeyIds = [],
  rentalObjectCode,
  onComplete,
  onCancel,
}: Props) {
  const { toast } = useToast()
  const [rows, setRows] = useState<KeyRow[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [keySystemSearch, setKeySystemSearch] = useState('')
  const [selectedKeySystem, setSelectedKeySystem] = useState<KeySystem | null>(
    null
  )

  // Key system search function
  const searchKeySystems = useCallback(
    async (query: string): Promise<KeySystem[]> => {
      return await keySystemSearchService.search({
        q: query,
        fields: ['systemCode'],
      })
    },
    []
  )

  const handleSelectKeySystem = useCallback((result: KeySystem | null) => {
    setSelectedKeySystem(result)
    if (result) {
      setKeySystemSearch(result.systemCode)
      // Update all rows with the selected key system
      setRows((prevRows) =>
        prevRows.map((row) => ({ ...row, keySystemId: result.id }))
      )
    } else {
      setKeySystemSearch('')
      // Clear key system from all rows
      setRows((prevRows) =>
        prevRows.map((row) => ({ ...row, keySystemId: undefined }))
      )
    }
  }, [])

  // Calculate next sequence number for a given type/name/flex combination
  // Uses the keys prop which contains all keys for this rental object
  // Also considers pending rows in the form to avoid duplicate sequence numbers
  const calculateNextSequenceNumber = useCallback(
    (
      keyType: KeyType,
      keyName: string,
      flexNumber: number | null,
      currentRows: KeyRow[] = []
    ): number => {
      const matchingKeys = keys.filter(
        (k) =>
          k.keyType === keyType &&
          k.keyName === keyName &&
          k.flexNumber === flexNumber &&
          !k.disposed // Exclude disposed keys
      )

      // Find the max sequence number from existing keys
      let maxSeq = 0
      if (matchingKeys.length > 0) {
        maxSeq = Math.max(
          ...matchingKeys.map((k) => Number(k.keySequenceNumber || 0))
        )
      }

      // Also check pending rows in the form
      const matchingRows = currentRows.filter(
        (r) =>
          r.keyType === keyType &&
          r.keyName === keyName &&
          r.flexNumber === flexNumber
      )

      if (matchingRows.length > 0) {
        const maxRowSeq = Math.max(
          ...matchingRows.map((r) => r.startingSequenceNumber + r.quantity - 1)
        )
        maxSeq = Math.max(maxSeq, maxRowSeq)
      }

      return maxSeq + 1
    },
    [keys]
  )

  // Initialize rows from selected keys
  useEffect(() => {
    if (selectedKeyIds.length === 0) {
      // No keys selected, add one empty row
      const defaultFlexNumber =
        keys.find((k) => k.rentalObjectCode === rentalObjectCode)?.flexNumber ??
        1

      setRows([
        {
          id: crypto.randomUUID(),
          keyType: 'LGH',
          keyName: '',
          flexNumber: defaultFlexNumber,
          quantity: 1,
          startingSequenceNumber: 1,
          keySystemId: selectedKeySystem?.id,
        },
      ])
      return
    }

    // Group selected keys by type/name/flex combination
    const selectedKeys = keys.filter((k) => selectedKeyIds.includes(k.id))
    const grouped = new Map<string, Key[]>()

    selectedKeys.forEach((key) => {
      const groupKey = `${key.keyType}-${key.keyName}-${key.flexNumber}`
      const existing = grouped.get(groupKey) || []
      grouped.set(groupKey, [...existing, key])
    })

    // Create rows from grouped keys
    const newRows: KeyRow[] = Array.from(grouped.values()).map((group) => {
      const firstKey = group[0]
      return {
        id: crypto.randomUUID(),
        keyType: firstKey.keyType as KeyType,
        keyName: firstKey.keyName,
        flexNumber: firstKey.flexNumber,
        quantity: 1, // Always start with quantity 1
        startingSequenceNumber: calculateNextSequenceNumber(
          firstKey.keyType as KeyType,
          firstKey.keyName,
          firstKey.flexNumber
        ),
        keySystemId: selectedKeySystem?.id,
      }
    })

    setRows(newRows)
  }, [
    selectedKeyIds,
    keys,
    rentalObjectCode,
    calculateNextSequenceNumber,
    selectedKeySystem,
  ])

  // Recalculate sequence numbers when keys changes
  useEffect(() => {
    if (rows.length === 0 || keys.length === 0) return

    setRows((prevRows) =>
      prevRows.map((row) => ({
        ...row,
        startingSequenceNumber: calculateNextSequenceNumber(
          row.keyType,
          row.keyName,
          row.flexNumber
        ),
      }))
    )
  }, [keys, calculateNextSequenceNumber])

  const handleAddRow = () => {
    const defaultFlexNumber =
      keys.find((k) => k.rentalObjectCode === rentalObjectCode)?.flexNumber ?? 1

    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        keyType: 'LGH',
        keyName: '',
        flexNumber: defaultFlexNumber,
        quantity: 1,
        startingSequenceNumber: 1,
        keySystemId: selectedKeySystem?.id,
      },
    ])
  }

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter((r) => r.id !== id))
  }

  const handleQuantityChange = (id: string, delta: number) => {
    setRows(
      rows.map((r) => {
        if (r.id === id) {
          const newQuantity = Math.min(20, Math.max(1, r.quantity + delta))
          return { ...r, quantity: newQuantity }
        }
        return r
      })
    )
  }

  const handleRowChange = (
    id: string,
    field: keyof KeyRow,
    value: string | number | null
  ) => {
    setRows((prevRows) =>
      prevRows.map((r) => {
        if (r.id !== id) return r

        const updated = { ...r, [field]: value }

        // Recalculate sequence number when type, name, or flex changes
        if (
          field === 'keyType' ||
          field === 'keyName' ||
          field === 'flexNumber'
        ) {
          // Filter out the current row to avoid self-comparison
          const otherRows = prevRows.filter((row) => row.id !== id)
          updated.startingSequenceNumber = calculateNextSequenceNumber(
            updated.keyType,
            updated.keyName,
            updated.flexNumber,
            otherRows
          )
        }

        return updated
      })
    )
  }

  const handleSubmit = async () => {
    if (rows.length === 0) return

    // Validate all rows have names
    const invalidRows = rows.filter((r) => !r.keyName.trim())
    if (invalidRows.length > 0) {
      toast({
        title: 'Valideringsfel',
        description: 'Alla rader måste ha ett nyckelnamn',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const keysToCreate: Array<{
        keyName: string
        keyType: KeyType
        keySequenceNumber: number
        flexNumber: number | null
        rentalObjectCode: string
        keySystemId?: string
      }> = []

      // Use selected key system if available, otherwise use default from rental object
      const keySystemId =
        selectedKeySystem?.id ??
        keys.find(
          (k) => k.rentalObjectCode === rentalObjectCode && k.keySystemId
        )?.keySystemId

      // Generate all keys from all rows
      for (const row of rows) {
        for (let i = 0; i < row.quantity; i++) {
          keysToCreate.push({
            keyName: row.keyName,
            keyType: row.keyType,
            keySequenceNumber: row.startingSequenceNumber + i,
            flexNumber: row.flexNumber,
            rentalObjectCode,
            keySystemId: row.keySystemId ?? keySystemId,
          })
        }
      }

      // Create all keys and collect their IDs
      const createdKeyIds: string[] = []
      for (const keyPayload of keysToCreate) {
        const created = await keyService.createKey({
          ...keyPayload,
        })
        createdKeyIds.push(created.id)
      }

      // Create ORDER event for all created keys
      if (createdKeyIds.length > 0) {
        try {
          await keyEventService.createKeyOrder(createdKeyIds)
        } catch (eventError) {
          console.error('Failed to create key order event:', eventError)
          // Don't fail the entire operation - event creation is supplementary
        }
      }

      toast({
        title: 'Nycklar skapade',
        description: `${createdKeyIds.length} ${createdKeyIds.length === 1 ? 'nyckel skapad' : 'nycklar skapade'}`,
      })

      setRows([])
      setKeySystemSearch('')
      setSelectedKeySystem(null)
      onComplete()
    } catch (e: any) {
      toast({
        title: 'Kunde inte skapa nycklar',
        description: e?.message ?? 'Okänt fel',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalKeysToCreate = rows.reduce((sum, row) => sum + row.quantity, 0)

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-12 gap-2 items-end p-2 border rounded-md bg-muted/30"
          >
            {/* Type dropdown */}
            <div className="col-span-2">
              <label className="text-xs block mb-1">Typ</label>
              <select
                className="h-8 w-full border rounded px-2 bg-background text-sm"
                value={row.keyType}
                onChange={(e) =>
                  handleRowChange(row.id, 'keyType', e.target.value as KeyType)
                }
                disabled={isSubmitting}
              >
                {Object.entries(KeyTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Name input */}
            <div className="col-span-2">
              <label className="text-xs block mb-1">Namn</label>
              <input
                className="h-8 w-full border rounded px-2 bg-background text-sm"
                value={row.keyName}
                onChange={(e) =>
                  handleRowChange(row.id, 'keyName', e.target.value)
                }
                disabled={isSubmitting}
                placeholder="Nyckelnamn"
              />
            </div>

            {/* Låssystem (searchable) */}
            <div className="col-span-2">
              <label className="text-xs block mb-1">Låssystem</label>
              <SearchDropdown
                preSuggestions={[]}
                searchFn={searchKeySystems}
                minSearchLength={3}
                debounceMs={500}
                formatItem={(result) => ({
                  primaryText: result.systemCode,
                  secondaryText: `${result.name}${result.manufacturer ? ` · ${result.manufacturer}` : ''} · ${result.type}`,
                  searchableText: `${result.systemCode} ${result.name} ${result.manufacturer || ''}`,
                })}
                getKey={(result) => result.id}
                value={keySystemSearch}
                onChange={setKeySystemSearch}
                onSelect={handleSelectKeySystem}
                selectedValue={selectedKeySystem}
                placeholder="Sök"
                emptyMessage="Inga låssystem hittades"
                loadingMessage="Söker..."
                showClearButton={true}
                className="h-8"
              />
            </div>

            {/* Flex input */}
            <div className="col-span-1">
              <label className="text-xs block mb-1">Flex</label>
              <input
                type="number"
                className="h-8 w-full border rounded px-2 bg-background text-sm"
                value={row.flexNumber ?? ''}
                onChange={(e) =>
                  handleRowChange(
                    row.id,
                    'flexNumber',
                    e.target.value === ''
                      ? null
                      : parseInt(e.target.value) || null
                  )
                }
                disabled={isSubmitting}
                min="1"
              />
            </div>

            {/* Starting löpnummer (read-only) */}
            <div className="col-span-1">
              <label className="text-xs block mb-1">Löpnr</label>
              <input
                className="h-8 w-full border rounded px-2 bg-muted text-muted-foreground text-sm"
                value={
                  row.quantity === 1
                    ? row.startingSequenceNumber
                    : `${row.startingSequenceNumber}-${row.startingSequenceNumber + row.quantity - 1}`
                }
                readOnly
              />
            </div>

            {/* Quantity controls */}
            <div className="col-span-2">
              <label className="text-xs block mb-1">Antal</label>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuantityChange(row.id, -1)}
                  disabled={isSubmitting || row.quantity <= 1}
                  className="h-8 w-8 p-0"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1 text-center text-sm font-medium">
                  {row.quantity}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuantityChange(row.id, 1)}
                  disabled={isSubmitting || row.quantity >= 20}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Remove button */}
            <div className="col-span-1 flex items-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveRow(row.id)}
                disabled={isSubmitting || rows.length === 1}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add row button */}
      <div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddRow}
          disabled={isSubmitting}
          className="flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Lägg till rad
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="mr-3">Objekt-ID: {rentalObjectCode}</span>
        <span>Totalt antal nycklar att skapa: {totalKeysToCreate}</span>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Avbryt
        </Button>
        <Button
          size="sm"
          disabled={rows.length === 0 || isSubmitting}
          onClick={handleSubmit}
        >
          Skapa ({totalKeysToCreate})
        </Button>
      </div>
    </div>
  )
}
