import { useState, useCallback } from 'react'
import { RentalObject } from '@onecore/types'

interface UseRentalRulesResult {
  rentalRules: Record<string, 'SCORED' | 'NON_SCORED'>
  handleRentalRuleChange: (
    rentalObjectCode: string,
    value: 'SCORED' | 'NON_SCORED'
  ) => void
  initializeRentalRules: (parkingSpaces: RentalObject[]) => void
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

  const initializeRentalRules = useCallback((parkingSpaces: RentalObject[]) => {
    const initialRentalRules = parkingSpaces.reduce(
      (acc, ps) => {
        acc[ps.rentalObjectCode] = 'SCORED' // Default to 'SCORED' (Intern)
        return acc
      },
      {} as Record<string, 'SCORED' | 'NON_SCORED'>
    )
    setRentalRules(initialRentalRules)
  }, [])

  return {
    rentalRules,
    handleRentalRuleChange,
    initializeRentalRules,
  }
}
