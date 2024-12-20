import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Company, Property, Building, Staircase, Residence } from '@/services/types'

interface NavigationContextType {
  selectedCompany: Company | null
  selectedProperty: Property | null
  selectedBuilding: Building | null
  selectedStaircase: Staircase | null
  selectedResidence: Residence | null
  setSelectedCompany: (company: Company | null) => void
  setSelectedProperty: (property: Property | null) => void
  setSelectedBuilding: (building: Building | null) => void
  setSelectedStaircase: (staircase: Staircase | null) => void
  setSelectedResidence: (residence: Residence | null) => void
  clearSelection: () => void
  clearSelection: () => void
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [selectedStaircase, setSelectedStaircase] = useState<Staircase | null>(null)
  const [selectedResidence, setSelectedResidence] = useState<Residence | null>(null)

  const clearSelection = useCallback(() => {
    setSelectedCompany(null)
    setSelectedProperty(null)
    setSelectedBuilding(null)
    setSelectedStaircase(null)
    setSelectedResidence(null)
  }, [])

  const setSelectedCompany = useCallback((company: Company | null) => {
    setSelectedCompany(company)
    if (!company) {
      clearSelection()
    }
  }, [clearSelection])

  const setSelectedProperty = useCallback((property: Property | null) => {
    setSelectedProperty(property)
    if (!property) {
      setSelectedBuilding(null)
      setSelectedStaircase(null)
      setSelectedResidence(null)
    }
  }, [])

  const setSelectedBuilding = useCallback((building: Building | null) => {
    setSelectedBuilding(building)
    if (!building) {
      setSelectedStaircase(null)
      setSelectedResidence(null)
    }
  }, [])

  const setSelectedStaircase = useCallback((staircase: Staircase | null) => {
    setSelectedStaircase(staircase)
    if (!staircase) {
      setSelectedResidence(null)
    }
  }, [])

  const setSelectedResidence = useCallback((residence: Residence | null) => {
    setSelectedResidence(residence)
  }, [])
    setSelectedCompany(null)
    setSelectedProperty(null)
    setSelectedBuilding(null)
    setSelectedStaircase(null)
    setSelectedResidence(null)
  }, [])

  return (
    <NavigationContext.Provider
      value={{
        selectedCompany,
        selectedProperty,
        selectedBuilding,
        selectedStaircase,
        selectedResidence,
        setSelectedCompany,
        setSelectedProperty,
        setSelectedBuilding,
        setSelectedStaircase,
        setSelectedResidence,
        clearSelection,
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider')
  }
  return context
}
