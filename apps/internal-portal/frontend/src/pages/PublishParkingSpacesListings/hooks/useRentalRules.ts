import { useState, useCallback } from 'react'

import { RentalObjectWithListingHistory } from '../../../types'

interface UseRentalRulesResult {
  rentalRules: Record<string, 'SCORED' | 'NON_SCORED'>
  handleRentalRuleChange: (
    rentalObjectCode: string,
    value: 'SCORED' | 'NON_SCORED'
  ) => void
  initializeRentalRules: (
    parkingSpaces: RentalObjectWithListingHistory[]
  ) => void
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
    (parkingSpaces: RentalObjectWithListingHistory[]) => {
      const initialRentalRules = parkingSpaces.reduce(
        (acc, ps) => {
          // If previous listings >= 1, default to NON_SCORED
          const hasPreviousListings = (ps.previousListingsCount ?? 0) >= 1

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
