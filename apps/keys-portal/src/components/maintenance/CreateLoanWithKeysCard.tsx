import { Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { KeySelectionCard } from '@/components/shared/KeySelectionCard'
import { maintenanceKeysService } from '@/services/api/maintenanceKeysService'
import type { Key } from '@/services/types'

interface CreateLoanWithKeysCardProps {
  onKeysSelected: (selectedKeys: Key[]) => void
}

/**
 * Card component for selecting keys to create a maintenance loan
 * Uses the generic KeySelectionCard component
 * Validates that keys don't have active maintenance loans
 */
export function CreateLoanWithKeysCard({
  onKeysSelected,
}: CreateLoanWithKeysCardProps) {
  const { toast } = useToast()

  const handleValidateKey = (key: Key) => {
    // Check if key has an active maintenance loan
    // Note: We check maintenanceLoanStatus if available (from KeyWithMaintenanceLoanStatus type)
    const keyWithStatus = key as any
    if (keyWithStatus.maintenanceLoanStatus?.hasActiveLoan) {
      toast({
        title: 'Nyckeln är redan utlånad',
        description: `${key.keyName} har ett aktivt entreprenörslån`,
        variant: 'destructive',
      })
      return { valid: false }
    }
    return { valid: true }
  }

  const handleAccept = async (selectedKeys: Key[]) => {
    // Just pass the selected keys back to parent
    // The parent will open the CreateMaintenanceLoanDialog
    onKeysSelected(selectedKeys)
  }

  return (
    <KeySelectionCard
      title="Skapa nytt entreprenörslån"
      buttonText="Acceptera {count}"
      buttonIcon={Check}
      onValidateKey={handleValidateKey}
      onAccept={handleAccept}
    />
  )
}
