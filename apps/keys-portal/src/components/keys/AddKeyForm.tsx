import { useState } from 'react'
import {
  parseSequenceNumberInput,
  checkForDuplicates,
} from '@/utils/keySequenceValidation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Key, KeyType, KeyTypeLabels } from '@/services/types'
import {
  rentalObjectSearchService,
  type RentalObjectSearchResult,
} from '@/services/api/rentalObjectSearchService'
import { keySystemSearchService } from '@/services/api/keySystemSearchService'
import type { KeySystem } from '@/services/types'
import { X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { SearchDropdown } from '@/components/ui/search-dropdown'

interface AddKeyFormProps {
  onSave: (key: Omit<Key, 'id' | 'createdAt' | 'updatedAt'>) => void
  onBatchSave: (batch: {
    keys: Array<Omit<Key, 'id' | 'createdAt' | 'updatedAt'>>
    createEvent: boolean
  }) => Promise<void>
  onCancel: () => void
  editingKey?: Key | null
}

export function AddKeyForm({
  onSave,
  onBatchSave,
  onCancel,
  editingKey,
}: AddKeyFormProps) {
  const { toast } = useToast()

  // Form state management with initial values from editingKey if provided
  const [formData, setFormData] = useState({
    keyName: editingKey?.keyName || '',
    keySequenceNumber: editingKey?.keySequenceNumber || '',
    flexNumber: editingKey ? editingKey.flexNumber || '' : 1,
    rentalObject: editingKey?.rentalObjectCode || '',
    keyType: editingKey?.keyType || ('LGH' as KeyType),
    keySystemId: editingKey?.keySystemId || '',
    disposed: editingKey?.disposed || false,
  })

  // Search state
  const [rentalObjectSearch, setRentalObjectSearch] = useState(
    editingKey?.rentalObjectCode || ''
  )
  const [selectedRentalObject, setSelectedRentalObject] =
    useState<RentalObjectSearchResult | null>(null)

  const [keySystemSearch, setKeySystemSearch] = useState('')
  const [selectedKeySystem, setSelectedKeySystem] = useState<KeySystem | null>(
    null
  )

  // Sequence number validation error
  const [sequenceNumberError, setSequenceNumberError] = useState<string>('')

  // Order event creation checkbox (only for create mode, not edit mode)
  const [shouldCreateEvent, setShouldCreateEvent] = useState(false)

  // Rental object search function
  const searchRentalObjects = async (
    query: string
  ): Promise<RentalObjectSearchResult[]> => {
    // The service has built-in validation (min 5 chars, digits/dashes only)
    // If invalid, it returns empty array
    try {
      return await rentalObjectSearchService.searchByRentalId(query)
    } catch (error) {
      console.error('Rental object search error:', error)
      return []
    }
  }

  // Key system search function
  const searchKeySystems = async (query: string): Promise<KeySystem[]> => {
    return await keySystemSearchService.search({
      q: query,
      fields: ['systemCode'],
    })
  }

  // Handle rental object selection
  const handleSelectRentalObject = (
    result: RentalObjectSearchResult | null
  ) => {
    if (result) {
      setSelectedRentalObject(result)
      setRentalObjectSearch(result.rentalId)
      setFormData((prev) => ({ ...prev, rentalObject: result.rentalId }))
    } else {
      setSelectedRentalObject(null)
      setFormData((prev) => ({ ...prev, rentalObject: '' }))
    }
  }

  // Handle key system selection
  const handleSelectKeySystem = (result: KeySystem | null) => {
    if (result) {
      setSelectedKeySystem(result)
      setKeySystemSearch(result.systemCode)
      setFormData((prev) => ({ ...prev, keySystemId: result.id }))
    } else {
      setSelectedKeySystem(null)
      setFormData((prev) => ({ ...prev, keySystemId: '' }))
    }
  }

  // Handle form submission and validation
  const handleSave = async () => {
    // Validate required fields
    if (!formData.keyName || !formData.keyType) return

    // Parse and validate sequence number input
    const sequenceValidation = parseSequenceNumberInput(
      String(formData.keySequenceNumber || '')
    )

    if (!sequenceValidation.isValid) {
      setSequenceNumberError(sequenceValidation.error || 'Ogiltigt löpnummer')
      return
    }

    // Clear any previous errors
    setSequenceNumberError('')

    // EDIT MODE: Use existing onSave (no changes to edit behavior)
    if (editingKey) {
      onSave({
        keyName: formData.keyName,
        keySequenceNumber: formData.keySequenceNumber
          ? Number(formData.keySequenceNumber)
          : undefined,
        flexNumber: formData.flexNumber
          ? Number(formData.flexNumber)
          : undefined,
        rentalObjectCode: formData.rentalObject || undefined,
        keyType: formData.keyType,
        keySystemId: formData.keySystemId || undefined,
        disposed: formData.disposed,
      })
      return
    }

    // CREATE MODE: Collect all keys into batch
    const keysToCreate: Array<Omit<Key, 'id' | 'createdAt' | 'updatedAt'>> = []

    if (sequenceValidation.numbers.length === 0) {
      // Single key without sequence number
      keysToCreate.push({
        keyName: formData.keyName,
        keySequenceNumber: undefined,
        flexNumber: formData.flexNumber
          ? Number(formData.flexNumber)
          : undefined,
        rentalObjectCode: formData.rentalObject || undefined,
        keyType: formData.keyType,
        keySystemId: formData.keySystemId || undefined,
      })
    } else {
      // Check for duplicate keys before creating
      const duplicates = await checkForDuplicates(
        formData.keyName,
        sequenceValidation.numbers,
        formData.keySystemId || undefined
      )

      // Filter out duplicates - only create keys that don't already exist
      const numbersToCreate = sequenceValidation.numbers.filter(
        (seqNum) => !duplicates.includes(seqNum)
      )

      // Show toast about duplicates if any
      if (numbersToCreate.length > 0 && duplicates.length > 0) {
        const eventNote = shouldCreateEvent
          ? ` Extranycklar beställs för löpnummer ${numbersToCreate.sort((a, b) => a - b).join(', ')}.`
          : ''

        toast({
          title: `${numbersToCreate.length} ${numbersToCreate.length === 1 ? 'nyckel' : 'nycklar'} kommer skapas`,
          description: `Nycklar med löpnummer ${duplicates.sort((a, b) => a - b).join(', ')} finns redan och hoppas över.${eventNote}`,
        })
      } else if (numbersToCreate.length === 0 && duplicates.length > 0) {
        toast({
          title: 'Inga nycklar att skapa',
          description: `Nycklar med löpnummer ${duplicates.sort((a, b) => a - b).join(', ')} finns redan.`,
          variant: 'destructive',
        })
        return
      }

      // Collect all non-duplicate keys
      numbersToCreate.forEach((seqNum) => {
        keysToCreate.push({
          keyName: formData.keyName,
          keySequenceNumber: seqNum,
          flexNumber: formData.flexNumber
            ? Number(formData.flexNumber)
            : undefined,
          rentalObjectCode: formData.rentalObject || undefined,
          keyType: formData.keyType,
          keySystemId: formData.keySystemId || undefined,
        })
      })
    }

    // Call batch save with checkbox state
    await onBatchSave({
      keys: keysToCreate,
      createEvent: shouldCreateEvent,
    })

    // Reset form after successful save
    setFormData({
      keyName: '',
      keySequenceNumber: '',
      flexNumber: 1,
      rentalObject: '',
      keyType: 'LGH',
      keySystemId: '',
      disposed: false,
    })
    setRentalObjectSearch('')
    setSelectedRentalObject(null)
    setKeySystemSearch('')
    setSelectedKeySystem(null)
    setSequenceNumberError('')
    setShouldCreateEvent(false)
  }

  // Handle form cancellation and reset form state
  const handleCancel = () => {
    onCancel()
    // Reset all form fields and search state
    setFormData({
      keyName: '',
      keySequenceNumber: '',
      flexNumber: 1,
      rentalObject: '',
      keyType: 'LGH',
      keySystemId: '',
      disposed: false,
    })
    setRentalObjectSearch('')
    setSelectedRentalObject(null)
    setKeySystemSearch('')
    setSelectedKeySystem(null)
    setSequenceNumberError('')
    setShouldCreateEvent(false)
  }

  return (
    <Card className="animate-fade-in mb-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">
          {editingKey ? 'Redigera nyckel' : 'Lägg till ny nyckel'}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="keyName" className="text-xs">
                Nyckelnamn *
              </Label>
              <Input
                id="keyName"
                className="h-8"
                value={formData.keyName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, keyName: e.target.value }))
                }
                placeholder="t.ex. CFG, BGH, BCD"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="keyType" className="text-xs">
                Typ *
              </Label>
              <Select
                value={formData.keyType}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    keyType: value as KeyType,
                  }))
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KeyTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="keySequenceNumber" className="text-xs">
                Löpnummer
              </Label>
              <Input
                id="keySequenceNumber"
                type="text"
                className={`h-8 ${sequenceNumberError ? 'border-red-500' : ''}`}
                value={formData.keySequenceNumber}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    keySequenceNumber: e.target.value,
                  }))
                  // Clear error when user starts typing
                  if (sequenceNumberError) {
                    setSequenceNumberError('')
                  }
                }}
                placeholder="1 eller 1-20 (max 20)"
              />
              {sequenceNumberError ? (
                <p className="text-xs text-red-600">{sequenceNumberError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ange ett nummer (t.ex. 5) eller intervall (t.ex. 1-10)
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="rentalObject" className="text-xs">
                Objekt
              </Label>
              <SearchDropdown
                preSuggestions={[]}
                searchFn={searchRentalObjects}
                minSearchLength={5}
                debounceMs={300}
                formatItem={(result) => ({
                  primaryText: result.rentalId,
                  secondaryText: `${result.address} · ${result.type}`,
                  searchableText: `${result.rentalId} ${result.address}`,
                })}
                getKey={(result) => result.rentalId}
                value={rentalObjectSearch}
                onChange={setRentalObjectSearch}
                onSelect={handleSelectRentalObject}
                selectedValue={selectedRentalObject}
                placeholder="t.ex. 811-039-05-0347"
                emptyMessage="Inga objekt hittades"
                loadingMessage="Söker..."
                showClearButton={false}
                className="h-8"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="keySystemId" className="text-xs">
                Låssystem
              </Label>
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
                placeholder="t.ex. ABC123"
                emptyMessage="Inga låssystem hittades"
                loadingMessage="Söker..."
                showClearButton={false}
                className="h-8"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="flexNumber" className="text-xs">
                Flexnr (1-3)
              </Label>
              <Input
                id="flexNumber"
                type="number"
                min="1"
                max="3"
                className="h-8"
                value={formData.flexNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    flexNumber: e.target.value,
                  }))
                }
                placeholder="1"
              />
            </div>

            {editingKey && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="disposed"
                    checked={formData.disposed}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        disposed: checked === true,
                      }))
                    }
                  />
                  <Label
                    htmlFor="disposed"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Kasserad
                  </Label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order event checkbox - only visible when creating (not editing) */}
        {!editingKey && (
          <div className="flex items-center space-x-2 pt-3 pb-2">
            <Checkbox
              id="createEvent"
              checked={shouldCreateEvent}
              onCheckedChange={(checked) =>
                setShouldCreateEvent(checked === true)
              }
            />
            <Label htmlFor="createEvent" className="text-sm cursor-pointer">
              Beställ extranyckel
            </Label>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            size="sm"
            disabled={!formData.keyName || !formData.keyType}
          >
            {editingKey ? 'Uppdatera' : 'Lägg till'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
