import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { updateKeyBundle } from '@/services/api/keyBundleService'
import { KeySelectionCard } from '@/components/shared/KeySelectionCard'
import type { Key, KeyBundle } from '@/services/types'

interface AddKeysToBundleCardProps {
  bundle: KeyBundle
  currentKeyIds: string[]
  onKeysAdded: () => void
}

/**
 * Card component for adding keys to a bundle
 * Uses the generic KeySelectionCard component
 */
export function AddKeysToBundleCard({
  bundle,
  currentKeyIds,
  onKeysAdded,
}: AddKeysToBundleCardProps) {
  const { toast } = useToast()
  const existingKeyIds = useMemo(() => new Set(currentKeyIds), [currentKeyIds])

  const handleValidateKey = (key: Key) => {
    // Don't add if already in the bundle
    if (currentKeyIds.includes(key.id)) {
      toast({
        title: 'Nyckeln finns redan i samlingen',
        description: `${key.keyName} är redan en del av ${bundle.name}`,
        variant: 'destructive',
      })
      return { valid: false }
    }
    return { valid: true }
  }

  const handleAccept = async (selectedKeys: Key[]) => {
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

      onKeysAdded()
    } catch (error) {
      console.error('Error adding keys to bundle:', error)
      toast({
        title: 'Kunde inte lägga till nycklar',
        description: 'Ett fel uppstod när nycklarna skulle läggas till',
        variant: 'destructive',
      })
      throw error // Re-throw to let KeySelectionCard handle the state
    }
  }

  return (
    <KeySelectionCard
      title="Lägg till nycklar i samlingen"
      buttonText="Lägg till {count}"
      buttonIcon={Plus}
      onValidateKey={handleValidateKey}
      onAccept={handleAccept}
      existingKeyIds={existingKeyIds}
    />
  )
}
