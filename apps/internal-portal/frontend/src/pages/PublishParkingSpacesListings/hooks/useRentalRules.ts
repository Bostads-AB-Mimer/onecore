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

          // If parking space is in specific residential areas (CEN, OXB, GRY), default to SCORED
          const isSpecialResidentialArea = ['CEN', 'OXB', 'GRY'].includes(
            ps.residentialAreaCode
          )

          // If parking space is in specific properties (24104,23001,23002,23003), default to SCORED
          const isSpecialProperty = [
            '24104',
            '23001',
            '23002',
            '23003',
          ].includes(ps.propertyCode || '')

          if (
            hasPreviousListings ||
            isSpecialResidentialArea ||
            isSpecialProperty
          ) {
            console.log(
              `Setting rental rule for ${ps.rentalObjectCode}: hasPreviousListings=${hasPreviousListings}, isSpecialResidentialArea=${isSpecialResidentialArea}, isSpecialProperty=${isSpecialProperty}`
            )
          }

          if (isSpecialResidentialArea || isSpecialProperty) {
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
