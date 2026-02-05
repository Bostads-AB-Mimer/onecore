import { useState, useEffect, useMemo } from 'react'
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
import {
  propertySearchService,
  type PropertySearchResult,
} from '@/services/api/propertySearchService'
import { X, FileText, Download, Trash2 } from 'lucide-react'
import { SearchDropdown } from '@/components/ui/search-dropdown'

type KeySystemFormData = Omit<KeySystem, 'id' | 'createdAt' | 'updatedAt'>

interface AddKeySystemFormProps {
  onSave: (
    keySystem: KeySystemFormData,
    schemaFile?: File | null
  ) => void | Promise<void>
  onCancel: () => void
  editingKeySystem?: KeySystem | null
  onSchemaUpload?: (keySystemId: string, file: File) => Promise<void>
  onSchemaDelete?: (keySystemId: string) => Promise<void>
  onSchemaDownload?: (keySystemId: string) => Promise<void>
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
  onSchemaUpload,
  onSchemaDelete,
  onSchemaDownload,
}: AddKeySystemFormProps) {
  const [formData, setFormData] = useState<KeySystemFormData>(emptyFormData)
  const [selectedSchemaFile, setSelectedSchemaFile] = useState<File | null>(
    null
  )
  const [isUploadingSchema, setIsUploadingSchema] = useState(false)

  // Property search state
  const [propertySearch, setPropertySearch] = useState('')
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([])

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

  // Property search function
  const searchProperties = async (
    query: string
  ): Promise<PropertySearchResult[]> => {
    return await propertySearchService.search({
      q: query,
      fields: ['designation', 'code', 'municipality'],
    })
  }

  // Filter out already selected properties
  const selectedPropertyIds = useMemo(
    () => new Set(selectedProperties.map((p) => p.id)),
    [selectedProperties]
  )

  // Wrap search function to filter out selected properties
  const searchPropertiesFiltered = async (
    query: string
  ): Promise<PropertySearchResult[]> => {
    const results = await searchProperties(query)
    return results.filter((property) => !selectedPropertyIds.has(property.id))
  }

  // Handle property selection
  const handleSelectProperty = (property: PropertySearchResult | null) => {
    if (property) {
      const newSelectedProperties = [...selectedProperties, property]
      setSelectedProperties(newSelectedProperties)
      setFormData((prev) => ({
        ...prev,
        propertyIds: JSON.stringify(newSelectedProperties.map((p) => p.id)),
      }))
      setPropertySearch('') // Clear search after selection
    }
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

    // Pass the schema file along with the form data
    onSave(KeySystemData, selectedSchemaFile)
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
              <Label htmlFor="system_code">Låssystem *</Label>
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

          <div className="grid grid-cols-2 gap-4">
            {/* Aktivt system toggle */}
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

            {/* Schema Upload Section */}
            <div className="space-y-2">
              {/* Show current schema if exists and no new file selected */}
              {editingKeySystem?.schemaFileId && !selectedSchemaFile && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                  <FileText className="h-4 w-4" />
                  <span className="flex-1 text-xs">Schema uppladdad</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onSchemaDownload?.(editingKeySystem.id)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Ladda ner
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={async () => {
                      if (
                        confirm('Är du säker på att du vill ta bort schemat?')
                      ) {
                        await onSchemaDelete?.(editingKeySystem.id)
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* File input for new upload/replace */}
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">
                  Schema (PDF)
                </Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  className="text-sm flex-1"
                  onChange={(e) =>
                    setSelectedSchemaFile(e.target.files?.[0] || null)
                  }
                />
              </div>

              {selectedSchemaFile && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 flex-1 truncate">
                      {selectedSchemaFile.name}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setSelectedSchemaFile(null)}
                      variant="ghost"
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Warning when replacing existing schema */}
                  {editingKeySystem?.schemaFileId && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                      <p className="font-medium text-yellow-800">
                        Obs! Det befintliga schemat kommer att raderas
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Upload button - only show if editing and file selected */}
              {editingKeySystem && selectedSchemaFile && (
                <Button
                  type="button"
                  size="sm"
                  className="w-full text-xs h-7"
                  onClick={async () => {
                    setIsUploadingSchema(true)
                    try {
                      await onSchemaUpload?.(
                        editingKeySystem.id,
                        selectedSchemaFile
                      )
                      setSelectedSchemaFile(null)
                    } finally {
                      setIsUploadingSchema(false)
                    }
                  }}
                  disabled={isUploadingSchema}
                >
                  {isUploadingSchema
                    ? 'Laddar upp...'
                    : editingKeySystem.schemaFileId
                      ? 'Ersätt schema'
                      : 'Ladda upp schema'}
                </Button>
              )}

              {/* Info text for create mode */}
              {!editingKeySystem && selectedSchemaFile && (
                <p className="text-xs text-gray-600">
                  Schemat kommer att laddas upp efter att låssystemet skapats.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="properties">Fastigheter</Label>
            <div className="space-y-2">
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

              {/* Search input for properties */}
              <SearchDropdown
                preSuggestions={[]}
                searchFn={searchPropertiesFiltered}
                minSearchLength={3}
                debounceMs={500}
                formatItem={(property) => ({
                  primaryText: property.designation || property.code,
                  secondaryText: `${property.tract}, ${property.municipality}`,
                  searchableText: `${property.designation || property.code} ${property.tract} ${property.municipality}`,
                })}
                getKey={(property) => property.id}
                value={propertySearch}
                onChange={setPropertySearch}
                onSelect={handleSelectProperty}
                selectedValue={null}
                placeholder="Sök fastighet..."
                emptyMessage={
                  selectedPropertyIds.size > 0
                    ? 'Alla hittade fastigheter är redan valda'
                    : 'Inga fastigheter hittades'
                }
                loadingMessage="Söker fastigheter..."
                showClearButton={false}
              />
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
