import { useState } from 'react'

import type { Contact } from '@/services/types'
import { createPendingLoan } from '@/services/loans/createLoan'
import { useToast } from '@/hooks/use-toast'

/**
 * Creates a maintenance loan (+ its pending LOAN receipt) for a company, then exposes
 * the new loan id so the dialog can open its receipt to print. Routes through
 * `createPendingLoan`, so the description is stored as `notes` (the field the API has)
 * instead of being silently dropped.
 */
export function useCreateMaintenanceLoan() {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdLoanId, setCreatedLoanId] = useState<string | null>(null)

  const create = async ({
    keyIds,
    company,
    contactPerson,
    description,
  }: {
    keyIds: string[]
    company: Contact
    contactPerson?: string | null
    description?: string | null
  }): Promise<boolean> => {
    setIsSubmitting(true)
    const result = await createPendingLoan({
      loanType: 'MAINTENANCE',
      keyIds,
      contact: company.contactCode,
      contactPerson: contactPerson || null,
      notes: description || null,
    })
    if (result.success) {
      const count = keyIds.length
      toast({
        title: 'Lån skapat',
        description: `${count} ${count === 1 ? 'nyckel' : 'nycklar'} har lånats ut till ${company.fullName}`,
      })
      setCreatedLoanId(result.loanId ?? null)
    } else {
      toast({
        title: result.title,
        description: result.message,
        variant: 'destructive',
      })
    }
    setIsSubmitting(false)
    return result.success
  }

  return {
    isSubmitting,
    createdLoanId,
    create,
    reset: () => setCreatedLoanId(null),
  }
}
