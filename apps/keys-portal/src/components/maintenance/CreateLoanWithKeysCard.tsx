import { Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { KeySelectionCard } from '@/components/shared/KeySelectionCard'
import { keyLoanService } from '@/services/api/keyLoanService'
import type { Key } from '@/services/types'

interface CreateLoanWithKeysCardProps {
  onKeysSelected: (selectedKeys: Key[]) => void
  loanedKeyIds?: Set<string>
}

/**
 * Card component for selecting keys to create a maintenance loan
 * Uses the generic KeySelectionCard component
 * Validates that keys don't have active maintenance loans
 */
export function CreateLoanWithKeysCard({
  onKeysSelected,
  loanedKeyIds,
}: CreateLoanWithKeysCardProps) {
  const { toast } = useToast()

  const handleValidateKey = async (key: Key) => {
    try {
      const loans = await keyLoanService.getByKeyId(key.id)
      const activeLoan = loans.find((loan) => !loan.returnedAt)
      if (activeLoan) {
        toast({
          title: 'Nyckeln är redan utlånad',
          description: `${key.keyName} har ett aktivt lån`,
          variant: 'destructive',
        })
        return { valid: false }
      }
    } catch {
      // If we can't verify loan status, allow selection
      // (backend will still reject on 409 if there's a conflict)
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
      title="Skapa nytt lån"
      buttonText="Acceptera {count}"
      buttonIcon={Check}
      onValidateKey={handleValidateKey}
      onAccept={handleAccept}
      existingKeyIds={loanedKeyIds}
    />
  )
}
