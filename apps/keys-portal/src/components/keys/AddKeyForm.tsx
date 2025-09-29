import { useState, useEffect } from 'react'
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
import { Key, KeyType, KeyTypeLabels } from '@/services/types'
import {
  rentalObjectSearchService,
  type RentalObjectSearchResult,
} from '@/services/api/rentalObjectSearchService'
import { X } from 'lucide-react'

interface AddKeyFormProps {
  onSave: (key: Omit<Key, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
  editingKey?: Key | null
}

export function AddKeyForm({ onSave, onCancel, editingKey }: AddKeyFormProps) {
  // Form state management with initial values from editingKey if provided
  const [formData, setFormData] = useState({
    keyName: editingKey?.keyName || '',
    keySequenceNumber: editingKey?.keySequenceNumber || '',
    flexNumber: editingKey?.flexNumber || '',
    rentalObject: editingKey?.rentalObjectCode || '',
    keyType: editingKey?.keyType || ('LGH' as KeyType),
    keySystemName: editingKey?.keySystemId || '',
  })

  // Search functionality state
  const [searchResults, setSearchResults] = useState<
    RentalObjectSearchResult[]
  >([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Effect hook that triggers rental object search when searchQuery changes
  useEffect(() => {
    const performSearch = async () => {
      // Clear results if search query is empty
      if (searchQuery.trim().length === 0) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      // Only search if the rental ID looks complete (has minimum length and valid format)
      if (!rentalObjectSearchService.isValidRentalId(searchQuery)) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      // Perform the actual search
      setIsSearching(true)
      try {
        const results =
          await rentalObjectSearchService.searchByRentalId(searchQuery)
        setSearchResults(results)
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    performSearch()
  }, [searchQuery])

  // Handle rental object input changes and trigger search
  const handleRentalObjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData((prev) => ({ ...prev, rentalObject: value }))
    setSearchQuery(value)
  }

  // Handle selection of a search result from the dropdown
  const handleSelectSearchResult = (result: RentalObjectSearchResult) => {
    setFormData((prev) => ({ ...prev, rentalObject: result.rentalId }))
    setSearchResults([])
    setSearchQuery('')
  }

  // Handle form submission and validation
  const handleSave = () => {
    // Validate required fields
    if (!formData.keyName || !formData.keyType) return

    // Prepare key data for saving, converting string numbers to actual numbers
    onSave({
      keyName: formData.keyName,
      keySequenceNumber: formData.keySequenceNumber
        ? Number(formData.keySequenceNumber)
        : undefined,
      flexNumber: formData.flexNumber ? Number(formData.flexNumber) : undefined,
      rentalObject: formData.rentalObject || undefined,
      keyType: formData.keyType,
      keySystemName: formData.keySystemName || undefined,
      keySystemId: undefined,
    })

    // Reset form after successful save
    setFormData({
      keyName: '',
      keySequenceNumber: '',
      flexNumber: '',
      rentalObject: '',
      keyType: 'LGH',
      keySystemName: '',
    })
    setSearchResults([])
    setSearchQuery('')
    setIsSearching(false)
  }

  // Handle form cancellation and reset form state
  const handleCancel = () => {
    onCancel()
    // Reset all form fields and search state
    setFormData({
      keyName: '',
      keySequenceNumber: '',
      flexNumber: '',
      rentalObject: '',
      keyType: 'LGH',
      keySystemName: '',
    })
    setSearchResults([])
    setSearchQuery('')
    setIsSearching(false)
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
                type="number"
                className="h-8"
                value={formData.keySequenceNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    keySequenceNumber: e.target.value,
                  }))
                }
                placeholder="1, 2, 3..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1 relative">
              <Label htmlFor="rentalObject" className="text-xs">
                Objekt
              </Label>
              <div className="relative">
                <Input
                  id="rentalObject"
                  className="h-8"
                  value={formData.rentalObject}
                  onChange={handleRentalObjectChange}
                  placeholder="t.ex. 811-039-05-0347"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-900"></div>
                  </div>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.rentalId}-${index}`}
                      type="button"
                      className="w-full text-left px-3 py-1 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none text-xs"
                      onClick={() => handleSelectSearchResult(result)}
                    >
                      <div className="font-medium">{result.rentalId}</div>
                      <div className="text-xs text-gray-600">
                        {result.address}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {result.type}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="keySystemName" className="text-xs">
                Låssystem
              </Label>
              <Input
                id="keySystemName"
                className="h-8"
                value={formData.keySystemName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    keySystemName: e.target.value,
                  }))
                }
                placeholder="t.ex. ABC123"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="flexNumber" className="text-xs">
                Flexnr
              </Label>
              <Input
                id="flexNumber"
                type="number"
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
          </div>
        </div>

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
