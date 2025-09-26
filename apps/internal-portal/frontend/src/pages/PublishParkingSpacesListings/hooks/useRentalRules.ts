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

          if (
            ps.isSpecialResidentialArea === true ||
            ps.isSpecialProperty === true
          ) {
            // Special areas/properties always default to SCORED, regardless of previous listings
            acc[ps.rentalObjectCode] = 'SCORED'
          } else if (hasPreviousListings) {
            // Only apply NON_SCORED for previous listings if not in special areas/properties
            acc[ps.rentalObjectCode] = 'NON_SCORED'
          } else {
            acc[ps.rentalObjectCode] = 'SCORED'
          }
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
