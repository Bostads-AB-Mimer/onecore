import { useState } from 'react'
import { Plus } from 'lucide-react'
import { KeyAutocomplete } from '@/components/maintenance/KeyAutocomplete'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { updateKeyBundle } from '@/services/api/keyBundleService'
import type { Key, KeyBundle } from '@/services/types'

interface AddKeysToBundleCardProps {
  bundle: KeyBundle
  currentKeyIds: string[]
  onKeysAdded: () => void
}

/**
 * Card component for adding keys to a bundle
 * Shows a search bar to find and add keys
 */
export function AddKeysToBundleCard({
  bundle,
  currentKeyIds,
  onKeysAdded,
}: AddKeysToBundleCardProps) {
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const handleAddKey = (key: Key) => {
    // Don't add if already in the bundle
    if (currentKeyIds.includes(key.id)) {
      toast({
        title: 'Nyckeln finns redan i samlingen',
        description: `${key.keyName} är redan en del av ${bundle.name}`,
        variant: 'destructive',
      })
      return
    }

    setSelectedKeys((prev) => [...prev, key])
  }

  const handleRemoveKey = (keyId: string) => {
    setSelectedKeys((prev) => prev.filter((k) => k.id !== keyId))
  }

  const handleSave = async () => {
    if (selectedKeys.length === 0) return

    setIsSaving(true)
    try {
      // Parse existing keys
      const existingKeyIds = JSON.parse(bundle.keys) as string[]

      // Add new keys
      const newKeyIds = selectedKeys.map((k) => k.id)
      const updatedKeyIds = [...existingKeyIds, ...newKeyIds]

      // Update bundle via API
      await updateKeyBundle(bundle.id, {
        keys: JSON.stringify(updatedKeyIds),
      })

      toast({
        title: 'Nycklar tillagda',
        description: `${selectedKeys.length} nyckel${selectedKeys.length > 1 ? 'ar' : ''} tillagda i ${bundle.name}`,
      })

      setSelectedKeys([])
      onKeysAdded()
    } catch (error) {
      console.error('Error adding keys to bundle:', error)
      toast({
        title: 'Kunde inte lägga till nycklar',
        description: 'Ett fel uppstod när nycklarna skulle läggas till',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Lägg till nycklar i samlingen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <KeyAutocomplete
          selectedKeys={selectedKeys}
          onAddKey={handleAddKey}
          onRemoveKey={handleRemoveKey}
          disabled={isSaving}
        />

        {selectedKeys.length > 0 && (
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Lägg till {selectedKeys.length} nyckel
            {selectedKeys.length > 1 ? 'ar' : ''}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
