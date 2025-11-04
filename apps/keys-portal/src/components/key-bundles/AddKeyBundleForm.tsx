import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyBundle, Key } from '@/services/types'
import { KeyAutocomplete } from '@/components/maintenance/KeyAutocomplete'
import { keyService } from '@/services/api/keyService'

type KeyBundleFormData = Omit<KeyBundle, 'id'> & { keys: string[] }

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

  useEffect(() => {
    const loadEditingData = async () => {
      if (editingKeyBundle) {
        // Parse keys array
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

        // Fetch full Key objects for the IDs so they can be displayed and removed
        if (keyIds.length > 0) {
          try {
            const keyPromises = keyIds.map((id) => keyService.getKey(id))
            const keys = await Promise.all(keyPromises)
            setSelectedKeys(keys.filter((k) => k != null))
          } catch (error) {
            console.error('Failed to fetch keys:', error)
            setSelectedKeys([])
          }
        } else {
          setSelectedKeys([])
        }
      } else {
        setFormData(emptyFormData)
        setSelectedKeys([])
      }
    }

    loadEditingData()
  }, [editingKeyBundle])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // When editing or creating, selectedKeys now contains ALL keys
      // (both originally selected and newly added)
      const allKeyIds = selectedKeys.map((k) => k.id)

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
              placeholder="t.ex. Entreprenörsnycklar Stockholm"
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
            <Label>Nycklar</Label>
            <KeyAutocomplete
              selectedKeys={selectedKeys}
              onAddKey={handleAddKey}
              onRemoveKey={handleRemoveKey}
              disabled={isLoading}
            />
            {selectedKeys.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedKeys.length} nyckel
                {selectedKeys.length === 1 ? '' : 'ar'} vald
                {selectedKeys.length === 1 ? '' : 'a'}. Klicka på X för att ta
                bort en nyckel.
              </p>
            )}
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
