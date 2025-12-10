import { useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  residenceService,
  buildingService,
  propertyService,
  companyService,
} from '@/services/api/core'

interface SelectionState {
  selectedResidenceId: string | null
  selectedBuildingId: string | null
  selectedBuildingCode: string | null
  selectedPropertyId: string | null
  selectedCompanyId: string | null
}

export function useHierarchicalSelection() {
  const location = useLocation()
  const params = useParams()

  // Get residence data if a residence is selected to extract hierarchy info
  const { data: selectedResidence } = useQuery({
    queryKey: ['residence', params.residenceId],
    queryFn: () => residenceService.getById(params.residenceId!),
    enabled:
      !!params.residenceId && location.pathname.startsWith('/residences/'),
  })

  // Get building data when navigating to a building without propertyId in state
  const { data: selectedBuilding } = useQuery({
    queryKey: ['building', params.buildingId],
    queryFn: () => buildingService.getById(params.buildingId!),
    enabled:
      !!params.buildingId &&
      location.pathname.startsWith('/buildings/') &&
      !(location.state as any)?.propertyId,
  })

  // Determine propertyId from various sources for the property query
  const propertyIdForQuery =
    params.propertyId || selectedBuilding?.property?.id || null

  // Get property data when we have a propertyId but no companyId in state
  const { data: selectedProperty } = useQuery({
    queryKey: ['property', propertyIdForQuery],
    queryFn: () => propertyService.getPropertyById(propertyIdForQuery!),
    enabled:
      !!propertyIdForQuery &&
      !(location.state as any)?.companyId &&
      (location.pathname.startsWith('/properties/') ||
        location.pathname.startsWith('/buildings/') ||
        location.pathname.startsWith('/residences/')),
  })

  // Get all companies to find which one owns the property
  const { data: allCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companyService.getAll(),
    enabled:
      !!selectedProperty &&
      !(location.state as any)?.companyId,
  })

  // Find company that owns this property by checking companies 001 and 006
  // 001 contains all properties except one, which is in 006
  const { data: propertyCompany } = useQuery({
    queryKey: ['propertyCompany', selectedProperty?.id, allCompanies],
    queryFn: async () => {
      if (!selectedProperty || !allCompanies) return null

      // Only check companies 001 and 006, with 001 first (most likely)
      const relevantCompanies = allCompanies
        .filter((c) => c.code === '001' || c.code === '006')
        .sort((a, b) => {
          if (a.code === '001') return -1
          if (b.code === '001') return 1
          return 0
        })

      for (const company of relevantCompanies) {
        try {
          const properties = await propertyService.getFromCompany(company)
          if (properties?.some((p: any) => p.id === selectedProperty.id)) {
            return company
          }
        } catch (error) {
          // Continue to next company if this one fails
          continue
        }
      }
      return null
    },
    enabled:
      !!selectedProperty && !!allCompanies,
  })

  const getSelectionState = (): SelectionState => {
    const path = location.pathname

    // Check for residence selection: /residences/:residenceId
    if (path.startsWith('/residences/') && params.residenceId) {
      // Extract building and property info from location state if available, or from residence data
      const state = location.state as any
      return {
        selectedResidenceId: params.residenceId,
        selectedBuildingId: null,
        selectedBuildingCode:
          state?.buildingCode || selectedResidence?.building?.code || null,
        selectedPropertyId:
          state?.propertyId ||
          state?.propertyCode ||
          selectedResidence?.property?.code ||
          null,
        selectedCompanyId:
          state?.companyId ||
          propertyCompany?.id ||
          null,
      }
    }

    // Check for property selection: /properties/:propertyId
    if (path.startsWith('/properties/') && params.propertyId) {
      const state = location.state as any
      return {
        selectedResidenceId: null,
        selectedBuildingId: null,
        selectedBuildingCode: null,
        selectedPropertyId: params.propertyId,
        selectedCompanyId:
          state?.companyId ||
          propertyCompany?.id ||
          null,
      }
    }

    // Check for company selection: /companies/:companyId
    if (path.startsWith('/companies/') && params.companyId) {
      return {
        selectedResidenceId: null,
        selectedBuildingId: null,
        selectedBuildingCode: null,
        selectedPropertyId: null,
        selectedCompanyId: params.companyId,
      }
    }

    // Check for building selection: /buildings/:buildingId
    if (path.startsWith('/buildings/') && params.buildingId) {
      const state = location.state as any
      return {
        selectedResidenceId: null,
        selectedBuildingId: params.buildingId,
        selectedBuildingCode:
          state?.buildingCode || selectedBuilding?.code || null,
        selectedPropertyId:
          state?.propertyId || selectedBuilding?.property?.id || null,
        selectedCompanyId:
          state?.companyId ||
          propertyCompany?.id ||
          null,
      }
    }

    return {
      selectedResidenceId: null,
      selectedBuildingId: null,
      selectedBuildingCode: null,
      selectedPropertyId: null,
      selectedCompanyId: null,
    }
  }

  const selectionState = getSelectionState()

  const isPropertyInHierarchy = (propertyId: string): boolean => {
    // Property is in hierarchy if it's directly selected OR if a child (building/residence) is selected
    return (
      selectionState.selectedPropertyId === propertyId ||
      (selectionState.selectedBuildingId !== null &&
        selectionState.selectedPropertyId === propertyId) ||
      (selectionState.selectedResidenceId !== null &&
        selectionState.selectedPropertyId === propertyId)
    )
  }

  const isBuildingInHierarchy = (
    buildingCode: string,
    propertyId: string,
    buildingId?: string
  ): boolean => {
    // Building is in hierarchy if:
    // 1. It's directly selected (by ID or code)
    // 2. A residence in this building is selected AND the property matches
    return (
      (buildingId && selectionState.selectedBuildingId === buildingId) ||
      selectionState.selectedBuildingCode === buildingCode ||
      (selectionState.selectedResidenceId !== null &&
        selectionState.selectedBuildingCode === buildingCode &&
        selectionState.selectedPropertyId === propertyId)
    )
  }

  const isResidenceSelected = (residenceId: string): boolean => {
    return selectionState.selectedResidenceId === residenceId
  }

  const isCompanyInHierarchy = (companyId: string): boolean => {
    // Company is in hierarchy if it's directly selected OR if any child is selected
    return selectionState.selectedCompanyId === companyId
  }

  return {
    selectionState,
    isPropertyInHierarchy,
    isBuildingInHierarchy,
    isResidenceSelected,
    isCompanyInHierarchy,
  }
}
