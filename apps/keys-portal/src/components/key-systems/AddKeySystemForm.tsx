import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  KeySystem,
  KeySystemType,
  KeySystemTypeLabels,
  Property,
} from '@/services/types'
import { useSearch } from '@/hooks/useSearch'
import { useDebounce } from '@/utils/debounce'
import {
  propertySearchService,
  type PropertySearchResult,
} from '@/services/api/propertySearchService'
import { X } from 'lucide-react'

type KeySystemFormData = Omit<KeySystem, 'id' | 'createdAt' | 'updatedAt'>

interface AddKeySystemFormProps {
  onSave: (keySystem: KeySystemFormData) => void
  onCancel: () => void
  editingKeySystem?: KeySystem | null
}

const emptyFormData: KeySystemFormData = {
  systemCode: '',
  name: '',
  manufacturer: '',
  managingSupplier: '',
  type: 'MECHANICAL',
  installationDate: '',
  isActive: true,
  description: '',
  propertyIds: '',
}

export function AddKeySystemForm({
  onSave,
  onCancel,
  editingKeySystem,
}: AddKeySystemFormProps) {
  const [formData, setFormData] = useState<KeySystemFormData>(emptyFormData)

  // Property search functionality state with debouncing
  const [propertySearchQuery, setPropertySearchQuery] = useState('')
  const [debouncedPropertyQuery, setDebouncedPropertyQuery] = useState('')
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([])

  // Debounce property search query (500ms delay)
  const updateDebouncedQuery = useDebounce((query: string) => {
    setDebouncedPropertyQuery(query)
  }, 500)

  // Use the reusable search hook
  const propertiesQuery = useSearch(
    (query: string) =>
      propertySearchService.search({
        q: query,
        fields: ['designation', 'code', 'municipality'],
      }),
    'search-properties',
    debouncedPropertyQuery
  )

  // Trigger debounced search when query changes
  useEffect(() => {
    updateDebouncedQuery(propertySearchQuery)
  }, [propertySearchQuery, updateDebouncedQuery])

  useEffect(() => {
    const loadEditingData = async () => {
      if (editingKeySystem) {
        // Parse propertyIds to get array of IDs
        let propertyIdArray: string[] = []
        if (editingKeySystem.propertyIds) {
          try {
            const parsed =
              typeof editingKeySystem.propertyIds === 'string'
                ? JSON.parse(editingKeySystem.propertyIds)
                : editingKeySystem.propertyIds
            propertyIdArray = Array.isArray(parsed) ? parsed : []
          } catch (e) {
            console.error('Failed to parse propertyIds:', e)
          }
        }

        // Fetch full Property objects for the IDs
        if (propertyIdArray.length > 0) {
          try {
            const properties =
              await propertySearchService.getByIds(propertyIdArray)
            setSelectedProperties(properties)
          } catch (error) {
            console.error('Failed to fetch properties:', error)
            setSelectedProperties([])
          }
        } else {
          setSelectedProperties([])
        }

        setFormData({
          systemCode: editingKeySystem.systemCode,
          name: editingKeySystem.name,
          manufacturer: editingKeySystem.manufacturer || '',
          managingSupplier: editingKeySystem.managingSupplier || '',
          type: editingKeySystem.type,
          installationDate: editingKeySystem.installationDate
            ? new Date(editingKeySystem.installationDate)
                .toISOString()
                .split('T')[0]
            : '',
          isActive: editingKeySystem.isActive || false,
          description: editingKeySystem.description || '',
          propertyIds: editingKeySystem.propertyIds || '',
        })
      } else {
        setFormData(emptyFormData)
        setSelectedProperties([])
      }
    }

    loadEditingData()
  }, [editingKeySystem])

  // Handle property input changes and trigger search
  const handlePropertySearchChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value
    setPropertySearchQuery(value)
  }

  // Handle selection of a property search result from the dropdown
  const handleSelectPropertyResult = (property: PropertySearchResult) => {
    if (!selectedProperties.find((p) => p.id === property.id)) {
      const newSelectedProperties = [...selectedProperties, property]
      setSelectedProperties(newSelectedProperties)
      setFormData((prev) => ({
        ...prev,
        propertyIds: JSON.stringify(newSelectedProperties.map((p) => p.id)),
      }))
    }
    setPropertySearchQuery('')
    setDebouncedPropertyQuery('')
  }

  // Handle removal of a selected property
  const handleRemoveProperty = (propertyId: string) => {
    const newSelectedProperties = selectedProperties.filter(
      (p) => p.id !== propertyId
    )
    setSelectedProperties(newSelectedProperties)
    setFormData((prev) => ({
      ...prev,
      propertyIds: JSON.stringify(newSelectedProperties.map((p) => p.id)),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Ensure propertyIds is a JSON string, not an array
    // Use selectedProperties as the source of truth for what should be saved
    const propertyIdsValue =
      selectedProperties.length > 0
        ? JSON.stringify(selectedProperties.map((p) => p.id))
        : '[]' // Send empty array to clear properties

    const KeySystemData = {
      ...formData,
      installationDate: formData.installationDate || undefined,
      manufacturer: formData.manufacturer || undefined,
      managingSupplier: formData.managingSupplier || undefined,
      description: formData.description || undefined,
      propertyIds: propertyIdsValue,
    }

    onSave(KeySystemData)
  }

  return (
    <Card className="animate-fade-in mb-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-1 pb-2">
        <CardTitle className="text-base">
          {editingKeySystem ? 'Redigera låssystem' : 'Skapa nytt låssystem'}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="system_code">Systemkod *</Label>
              <Input
                id="system_code"
                value={formData.systemCode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    systemCode: e.target.value,
                  }))
                }
                placeholder="t.ex. ABC123"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Namn *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Låssystemets namn"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Tillverkare</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    manufacturer: e.target.value,
                  }))
                }
                placeholder="t.ex. ASSA ABLOY"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="managing_supplier">Förvaltande leverantör</Label>
              <Input
                id="managing_supplier"
                value={formData.managingSupplier}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    managingSupplier: e.target.value,
                  }))
                }
                placeholder="Leverantör"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Typ *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: KeySystemType) =>
                  setFormData((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KeySystemTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="installation_date">Installationsdatum</Label>
              <Input
                id="installation_date"
                type="date"
                value={formData.installationDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    installationDate: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.isActive}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, isActive: checked }))
              }
            />
            <Label htmlFor="is_active">Aktivt system</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="properties">Fastigheter</Label>
            <div className="space-y-2">
              {/* Search input for properties */}
              <div className="relative">
                <Input
                  id="properties"
                  value={propertySearchQuery}
                  onChange={handlePropertySearchChange}
                  placeholder="Sök fastighet..."
                />
                {propertiesQuery.isFetching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-900"></div>
                  </div>
                )}

                {/* Search results dropdown */}
                {!propertiesQuery.isFetching &&
                  propertiesQuery.data &&
                  propertiesQuery.data.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                      {propertiesQuery.data.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none text-sm"
                          onClick={() => handleSelectPropertyResult(result)}
                        >
                          <div className="font-medium">
                            {result.designation || result.code}
                          </div>
                          <div className="text-xs text-gray-600">
                            {result.tract}, {result.municipality}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              {/* Selected properties list */}
              {selectedProperties.length > 0 && (
                <div className="border rounded-lg p-2 space-y-1">
                  {selectedProperties.map((property) => (
                    <div
                      key={property.id}
                      className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-sm"
                    >
                      <span>
                        {property.designation || property.code} -{' '}
                        {property.tract}, {property.municipality}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleRemoveProperty(property.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivning</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Beskrivning av låssystemet..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Avbryt
            </Button>
            <Button type="submit">
              {editingKeySystem ? 'Uppdatera' : 'Skapa'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
