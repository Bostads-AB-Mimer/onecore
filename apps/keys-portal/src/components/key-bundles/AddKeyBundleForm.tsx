import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyBundle, Key } from '@/services/types'
import { KeyAutocomplete } from '@/components/maintenance/KeyAutocomplete'

type KeyBundleFormData = {
  name: string
  description: string | null
  keys: string[]
}

interface AddKeyBundleFormProps {
  onSave: (keyBundle: KeyBundleFormData) => void | Promise<void>
  onCancel: () => void
  editingKeyBundle?: KeyBundle | null
}

const emptyFormData: KeyBundleFormData = {
  name: '',
  description: '',
  keys: [],
}

export function AddKeyBundleForm({
  onSave,
  onCancel,
  editingKeyBundle,
}: AddKeyBundleFormProps) {
  const [formData, setFormData] = useState<KeyBundleFormData>(emptyFormData)
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const existingKeyIds = useMemo(() => new Set(formData.keys), [formData.keys])

  useEffect(() => {
    if (editingKeyBundle) {
      let keyIds: string[] = []
      if (editingKeyBundle.keys) {
        try {
          const parsed =
            typeof editingKeyBundle.keys === 'string'
              ? JSON.parse(editingKeyBundle.keys)
              : editingKeyBundle.keys
          keyIds = Array.isArray(parsed) ? parsed : []
        } catch (e) {
          console.error('Failed to parse keys:', e)
        }
      }

      setFormData({
        name: editingKeyBundle.name,
        description: editingKeyBundle.description || '',
        keys: keyIds,
      })
      setSelectedKeys([])
    } else {
      setFormData(emptyFormData)
      setSelectedKeys([])
    }
  }, [editingKeyBundle])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const newKeyIds = selectedKeys.map((k) => k.id)
      const allKeyIds = [...formData.keys, ...newKeyIds]

      await onSave({
        ...formData,
        keys: allKeyIds,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddKey = (key: Key) => {
    setSelectedKeys((prev) => [...prev, key])
  }

  const handleRemoveKey = (keyId: string) => {
    setSelectedKeys((prev) => prev.filter((k) => k.id !== keyId))
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>
          {editingKeyBundle ? 'Redigera nyckelsamling' : 'Ny nyckelsamling'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Namn <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="t.ex. Nycklar förvaltning Stockholm"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Beskrivning</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Frivillig beskrivning av nyckelsamlingen"
              rows={3}
            />
          </div>

          {/* Keys Selection */}
          <div className="space-y-2">
            <KeyAutocomplete
              selectedKeys={selectedKeys}
              onAddKey={handleAddKey}
              onRemoveKey={handleRemoveKey}
              disabled={isLoading}
              existingKeyIds={existingKeyIds}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim()}>
              {isLoading
                ? 'Sparar...'
                : editingKeyBundle
                  ? 'Uppdatera'
                  : 'Skapa'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
