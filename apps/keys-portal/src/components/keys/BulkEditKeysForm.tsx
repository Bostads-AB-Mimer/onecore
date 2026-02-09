import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchDropdown } from '@/components/ui/search-dropdown'
import { KeySystem } from '@/services/types'
import { keySystemSearchService } from '@/services/api/keySystemSearchService'
import {
  rentalObjectSearchService,
  type RentalObjectSearchResult,
} from '@/services/api/rentalObjectSearchService'
import { X, Loader2 } from 'lucide-react'

interface BulkEditFormState {
  keyName: string
  flexNumber: number | null
  keySystemId: string | null
  selectedKeySystem: KeySystem | null
  keySystemSearch: string
  rentalObjectCode: string
  selectedRentalObject: RentalObjectSearchResult | null
  rentalObjectSearch: string
  disposed: boolean | null
}

interface BulkEditKeysFormProps {
  selectedCount: number
  onSave: (updates: {
    keyName?: string
    flexNumber?: number | null
    keySystemId?: string | null
    rentalObjectCode?: string
    disposed?: boolean
  }) => Promise<void>
  onCancel: () => void
}

const initialFormState: BulkEditFormState = {
  keyName: '',
  flexNumber: null,
  keySystemId: null,
  selectedKeySystem: null,
  keySystemSearch: '',
  rentalObjectCode: '',
  selectedRentalObject: null,
  rentalObjectSearch: '',
  disposed: null,
}

export function BulkEditKeysForm({
  selectedCount,
  onSave,
  onCancel,
}: BulkEditKeysFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formState, setFormState] =
    useState<BulkEditFormState>(initialFormState)

  const searchKeySystems = async (query: string): Promise<KeySystem[]> => {
    return await keySystemSearchService.search({
      q: query,
      fields: ['systemCode', 'name'],
    })
  }

  const searchRentalObjects = async (
    query: string
  ): Promise<RentalObjectSearchResult[]> => {
    try {
      return await rentalObjectSearchService.searchByRentalId(query)
    } catch (error) {
      console.error('Rental object search error:', error)
      return []
    }
  }

  const handleSave = async () => {
    const updates: {
      keyName?: string
      flexNumber?: number | null
      keySystemId?: string | null
      rentalObjectCode?: string
      disposed?: boolean
    } = {}

    if (formState.keyName) {
      updates.keyName = formState.keyName
    }
    if (formState.flexNumber !== null) {
      updates.flexNumber = formState.flexNumber
    }
    if (formState.keySystemId !== null) {
      updates.keySystemId = formState.keySystemId
    }
    if (formState.rentalObjectCode) {
      updates.rentalObjectCode = formState.rentalObjectCode
    }
    if (formState.disposed !== null) {
      updates.disposed = formState.disposed
    }

    if (Object.keys(updates).length === 0) {
      return
    }

    setIsLoading(true)
    try {
      await onSave(updates)
      setFormState(initialFormState)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (!isLoading) {
      onCancel()
      setFormState(initialFormState)
    }
  }

  const hasChanges =
    !!formState.keyName ||
    formState.flexNumber !== null ||
    formState.keySystemId !== null ||
    !!formState.rentalObjectCode ||
    formState.disposed !== null

  return (
    <Card className="animate-fade-in mb-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">
          Redigera {selectedCount} nycklar
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Fyll i de fält du vill ändra. Endast ifyllda fält kommer att
          uppdateras.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            {/* Key Name */}
            <div className="space-y-1">
              <Label htmlFor="keyName" className="text-xs">
                Nyckelnamn
              </Label>
              <Input
                id="keyName"
                value={formState.keyName}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    keyName: e.target.value,
                  }))
                }
                placeholder="t.ex. Lägenhetsnyckel"
                disabled={isLoading}
                className="h-8"
              />
            </div>

            {/* Flex Number */}
            <div className="space-y-1">
              <Label htmlFor="flexNumber" className="text-xs">
                Flex-nummer
              </Label>
              <Select
                disabled={isLoading}
                value={formState.flexNumber?.toString() ?? ''}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    flexNumber: value ? parseInt(value, 10) : null,
                  }))
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Välj flex-nummer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Key System */}
            <div className="space-y-1">
              <Label htmlFor="keySystem" className="text-xs">
                Låssystem
              </Label>
              <SearchDropdown
                preSuggestions={[]}
                searchFn={searchKeySystems}
                minSearchLength={1}
                formatItem={(item: KeySystem) => ({
                  primaryText: item.systemCode,
                  secondaryText: item.name || undefined,
                  searchableText: `${item.systemCode} ${item.name || ''}`,
                })}
                getKey={(item: KeySystem) => item.id}
                value={formState.keySystemSearch}
                onChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    keySystemSearch: value,
                  }))
                }
                onSelect={(keySystem: KeySystem | null) =>
                  setFormState((prev) => ({
                    ...prev,
                    selectedKeySystem: keySystem,
                    keySystemId: keySystem?.id ?? null,
                  }))
                }
                selectedValue={formState.selectedKeySystem}
                placeholder="Sök låssystem..."
                disabled={isLoading}
                className="h-8"
              />
            </div>
          </div>

          <div className="space-y-3">
            {/* Rental Object Code */}
            <div className="space-y-1">
              <Label htmlFor="rentalObjectCode" className="text-xs">
                Objekt
              </Label>
              <SearchDropdown
                preSuggestions={[]}
                searchFn={searchRentalObjects}
                minSearchLength={5}
                debounceMs={300}
                formatItem={(result: RentalObjectSearchResult) => ({
                  primaryText: result.rentalId,
                  secondaryText: `${result.address} · ${result.type}`,
                  searchableText: `${result.rentalId} ${result.address}`,
                })}
                getKey={(result: RentalObjectSearchResult) => result.rentalId}
                value={formState.rentalObjectSearch}
                onChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    rentalObjectSearch: value,
                  }))
                }
                onSelect={(rentalObject: RentalObjectSearchResult | null) =>
                  setFormState((prev) => ({
                    ...prev,
                    selectedRentalObject: rentalObject,
                    rentalObjectCode: rentalObject?.rentalId ?? '',
                  }))
                }
                selectedValue={formState.selectedRentalObject}
                placeholder="t.ex. 811-039-05-0347"
                emptyMessage="Inga objekt hittades"
                loadingMessage="Söker..."
                disabled={isLoading}
                className="h-8"
              />
            </div>

            {/* Disposed */}
            <div className="space-y-1">
              <Label htmlFor="disposed" className="text-xs">
                Kasserad
              </Label>
              <Select
                disabled={isLoading}
                value={
                  formState.disposed === null
                    ? ''
                    : formState.disposed.toString()
                }
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    disposed: value === 'true',
                  }))
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Välj status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ja (kasserad)</SelectItem>
                  <SelectItem value="false">Nej (aktiv)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            size="sm"
            disabled={!hasChanges || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Uppdatera {selectedCount} nycklar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
