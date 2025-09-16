import { useState, useCallback } from 'react'
import { RentalObject } from '@onecore/types'

// Local extension of RentalObject for frontend features
interface RentalObjectWithAttempts extends RentalObject {
  listingAttemptsCount?: number
}

interface UseRentalRulesResult {
  rentalRules: Record<string, 'SCORED' | 'NON_SCORED'>
  handleRentalRuleChange: (
    rentalObjectCode: string,
    value: 'SCORED' | 'NON_SCORED'
  ) => void
  initializeRentalRules: (parkingSpaces: RentalObjectWithAttempts[]) => void
}

export const useRentalRules = (): UseRentalRulesResult => {
  const [rentalRules, setRentalRules] = useState<
    Record<string, 'SCORED' | 'NON_SCORED'>
  >({})

  const handleRentalRuleChange = useCallback(
    (rentalObjectCode: string, value: 'SCORED' | 'NON_SCORED') => {
      setRentalRules((prev) => ({
        ...prev,
        [rentalObjectCode]: value,
      }))
    },
    []
  )

  const initializeRentalRules = useCallback(
    (parkingSpaces: RentalObjectWithAttempts[]) => {
      const initialRentalRules = parkingSpaces.reduce(
        (acc, ps) => {
          // If listing attempts >= 1, default to NON_SCORED, otherwise SCORED
          const hasAttempts = (ps.listingAttemptsCount ?? 0) >= 1
          acc[ps.rentalObjectCode] = hasAttempts ? 'NON_SCORED' : 'SCORED'
          return acc
        },
        {} as Record<string, 'SCORED' | 'NON_SCORED'>
      )
      setRentalRules(initialRentalRules)
    },
    []
  )

  return {
    rentalRules,
    handleRentalRuleChange,
    initializeRentalRules,
  }
}
