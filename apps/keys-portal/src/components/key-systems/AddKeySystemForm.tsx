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
import { sampleProperties } from '@/mockdata/sampleProperties'
import { Checkbox } from '@/components/ui/checkbox'

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
    }
  }, [editingKeySystem])

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
            <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
              {sampleProperties.map((property) => (
                <div
                  key={property.id}
                  className="flex items-center space-x-2 mb-2 last:mb-0"
                >
                  <Checkbox
                    id={`property-${property.id}`}
                    checked={formData.property_ids.includes(property.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData((prev) => ({
                          ...prev,
                          property_ids: [...prev.property_ids, property.id],
                        }))
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          property_ids: prev.property_ids.filter(
                            (id) => id !== property.id
                          ),
                        }))
                      }
                    }}
                  />
                  <Label
                    htmlFor={`property-${property.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {property.name} - {property.address}
                  </Label>
                </div>
              ))}
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
