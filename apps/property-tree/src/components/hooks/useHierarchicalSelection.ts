import { useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { residenceService } from '@/services/api/core'

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
          state?.propertyId || selectedResidence?.property?.code || null,
        selectedCompanyId: state?.companyId || null,
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
        selectedCompanyId: state?.companyId || null,
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
        selectedBuildingCode: state?.buildingCode || null,
        selectedPropertyId: state?.propertyId || null,
        selectedCompanyId: state?.companyId || null,
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
    return (
      selectionState.selectedCompanyId === companyId ||
      (selectionState.selectedPropertyId !== null &&
        selectionState.selectedCompanyId === companyId) ||
      (selectionState.selectedBuildingId !== null &&
        selectionState.selectedCompanyId === companyId) ||
      (selectionState.selectedResidenceId !== null &&
        selectionState.selectedCompanyId === companyId)
    )
  }

  return {
    selectionState,
    isPropertyInHierarchy,
    isBuildingInHierarchy,
    isResidenceSelected,
    isCompanyInHierarchy,
  }
}
