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

interface AddKeySystemFormProps {
  onSave: (
    keySystem: Omit<KeySystem, 'id' | 'created_at' | 'updated_at'>
  ) => void
  onCancel: () => void
  editingKeySystem?: KeySystem | null
}

export function AddKeySystemForm({
  onSave,
  onCancel,
  editingKeySystem,
}: AddKeySystemFormProps) {
  const [formData, setFormData] = useState({
    system_code: '',
    name: '',
    manufacturer: '',
    managing_supplier: '',
    type: 'MECHANICAL' as KeySystemType,
    installation_date: '',
    is_active: true,
    description: '',
    property_ids: [] as string[],
  })

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
    if (editingKeySystem) {
      setFormData({
        system_code: editingKeySystem.system_code,
        name: editingKeySystem.name,
        manufacturer: editingKeySystem.manufacturer || '',
        managing_supplier: editingKeySystem.managing_supplier || '',
        type: editingKeySystem.type,
        installation_date: editingKeySystem.installation_date
          ? new Date(editingKeySystem.installation_date)
              .toISOString()
              .split('T')[0]
          : '',
        is_active: editingKeySystem.is_active,
        description: editingKeySystem.description || '',
        property_ids: editingKeySystem.property_ids || [],
      })
    } else {
      setFormData({
        system_code: '',
        name: '',
        manufacturer: '',
        managing_supplier: '',
        type: 'MECHANICAL',
        installation_date: '',
        is_active: true,
        description: '',
        property_ids: [],
      })
      setSelectedProperties([])
    }
  }, [editingKeySystem])

  // Handle property input changes and trigger search
  const handlePropertySearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        property_ids: newSelectedProperties.map((p) => p.id),
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
      property_ids: newSelectedProperties.map((p) => p.id),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const KeySystemData = {
      ...formData,
      installation_date: formData.installation_date || undefined,
      manufacturer: formData.manufacturer || undefined,
      managing_supplier: formData.managing_supplier || undefined,
      description: formData.description || undefined,
      property_ids:
        formData.property_ids.length > 0 ? formData.property_ids : undefined,
      created_by: undefined,
      updated_by: undefined,
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
                value={formData.system_code}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    system_code: e.target.value,
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
                value={formData.managing_supplier}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    managing_supplier: e.target.value,
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
                value={formData.installation_date}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    installation_date: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, is_active: checked }))
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
                        {property.designation || property.code} - {property.tract},{' '}
                        {property.municipality}
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
