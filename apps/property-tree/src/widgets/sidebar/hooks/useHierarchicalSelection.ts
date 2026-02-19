import { useCallback, useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { useBuilding } from '@/features/buildings'
import { useCompanyByPropertyId } from '@/features/companies'
import { useProperty } from '@/features/properties'
import { useResidence } from '@/features/residences'

import { matchesRoute, routes } from '@/shared/routes'

interface SelectionState {
  selectedResidenceId: string | null
  selectedBuildingId: string | null
  selectedBuildingCode: string | null
  selectedPropertyId: string | null
  selectedOrganizationNumber: string | null
}

export function useHierarchicalSelection() {
  const location = useLocation()
  const params = useParams()
  const state = location.state as Record<string, string> | null

  const residenceId =
    params.residenceId && matchesRoute(routes.residence, location.pathname)
      ? params.residenceId
      : undefined
  const { data: selectedResidence } = useResidence(residenceId)

  const buildingCodeForQuery =
    params.buildingCode &&
    matchesRoute(routes.building, location.pathname) &&
    !state?.propertyId
      ? params.buildingCode
      : undefined
  const { data: selectedBuilding } = useBuilding(buildingCodeForQuery)

  const needsProperty =
    !state?.organizationNumber &&
    (matchesRoute(routes.property, location.pathname) ||
      matchesRoute(routes.building, location.pathname) ||
      matchesRoute(routes.residence, location.pathname))
  const propertyIdForQuery = needsProperty
    ? params.propertyId || selectedBuilding?.property?.id || undefined
    : undefined
  const { data: selectedProperty } = useProperty(propertyIdForQuery)

  const companyPropertyId =
    selectedProperty && !state?.organizationNumber
      ? selectedProperty.id
      : undefined
  const { data: propertyCompany } = useCompanyByPropertyId(companyPropertyId)

  const selectionState = useMemo((): SelectionState => {
    const path = location.pathname
    const organizationNumber =
      state?.organizationNumber || propertyCompany?.organizationNumber || null

    if (matchesRoute(routes.residence, path) && params.residenceId) {
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
        selectedOrganizationNumber: organizationNumber,
      }
    }

    if (matchesRoute(routes.property, path) && params.propertyId) {
      return {
        selectedResidenceId: null,
        selectedBuildingId: null,
        selectedBuildingCode: null,
        selectedPropertyId: params.propertyId,
        selectedOrganizationNumber: organizationNumber,
      }
    }

    if (matchesRoute(routes.company, path) && params.organizationNumber) {
      return {
        selectedResidenceId: null,
        selectedBuildingId: null,
        selectedBuildingCode: null,
        selectedPropertyId: null,
        selectedOrganizationNumber: params.organizationNumber,
      }
    }

    if (matchesRoute(routes.building, path) && params.buildingCode) {
      return {
        selectedResidenceId: null,
        selectedBuildingId: null,
        selectedBuildingCode:
          params.buildingCode ||
          state?.buildingCode ||
          selectedBuilding?.code ||
          null,
        selectedPropertyId:
          state?.propertyId || selectedBuilding?.property?.id || null,
        selectedOrganizationNumber: organizationNumber,
      }
    }

    return {
      selectedResidenceId: null,
      selectedBuildingId: null,
      selectedBuildingCode: null,
      selectedPropertyId: null,
      selectedOrganizationNumber: null,
    }
  }, [
    location.pathname,
    params,
    state,
    selectedResidence,
    selectedBuilding,
    propertyCompany,
  ])

  const isPropertyInHierarchy = useCallback(
    (propertyId: string) => selectionState.selectedPropertyId === propertyId,
    [selectionState.selectedPropertyId]
  )

  const isBuildingInHierarchy = useCallback(
    (buildingCode: string, propertyId: string, buildingId?: string) =>
      (!!buildingId && selectionState.selectedBuildingId === buildingId) ||
      selectionState.selectedBuildingCode === buildingCode ||
      (selectionState.selectedResidenceId !== null &&
        selectionState.selectedBuildingCode === buildingCode &&
        selectionState.selectedPropertyId === propertyId),
    [selectionState]
  )

  const isResidenceSelected = useCallback(
    (residenceId: string) => selectionState.selectedResidenceId === residenceId,
    [selectionState.selectedResidenceId]
  )

  const isCompanyInHierarchy = useCallback(
    (organizationNumber: string) =>
      selectionState.selectedOrganizationNumber === organizationNumber,
    [selectionState.selectedOrganizationNumber]
  )

  return {
    selectionState,
    isPropertyInHierarchy,
    isBuildingInHierarchy,
    isResidenceSelected,
    isCompanyInHierarchy,
  }
}
