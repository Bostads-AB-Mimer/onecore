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
  selectedCompanyId: string | null
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

  const buildingId =
    params.buildingId &&
    matchesRoute(routes.building, location.pathname) &&
    !state?.propertyId
      ? params.buildingId
      : undefined
  const { data: selectedBuilding } = useBuilding(buildingId)

  const needsProperty =
    !state?.companyId &&
    (matchesRoute(routes.property, location.pathname) ||
      matchesRoute(routes.building, location.pathname) ||
      matchesRoute(routes.residence, location.pathname))
  const propertyIdForQuery = needsProperty
    ? params.propertyCode || selectedBuilding?.property?.code || undefined
    : undefined
  const { data: selectedProperty } = useProperty(propertyIdForQuery)

  const companyPropertyId =
    selectedProperty && !state?.companyId ? selectedProperty.id : undefined
  const { data: propertyCompany } = useCompanyByPropertyId(companyPropertyId)

  const selectionState = useMemo((): SelectionState => {
    const path = location.pathname
    const companyId = state?.companyId || propertyCompany?.id || null

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
        selectedCompanyId: companyId,
      }
    }

    if (matchesRoute(routes.property, path) && params.propertyCode) {
      return {
        selectedResidenceId: null,
        selectedBuildingId: null,
        selectedBuildingCode: null,
        selectedPropertyId: params.propertyCode,
        selectedCompanyId: companyId,
      }
    }

    if (matchesRoute(routes.company, path) && params.companyId) {
      return {
        selectedResidenceId: null,
        selectedBuildingId: null,
        selectedBuildingCode: null,
        selectedPropertyId: null,
        selectedCompanyId: params.companyId,
      }
    }

    if (matchesRoute(routes.building, path) && params.buildingId) {
      return {
        selectedResidenceId: null,
        selectedBuildingId: params.buildingId,
        selectedBuildingCode:
          state?.buildingCode || selectedBuilding?.code || null,
        selectedPropertyId:
          state?.propertyId || selectedBuilding?.property?.id || null,
        selectedCompanyId: companyId,
      }
    }

    return {
      selectedResidenceId: null,
      selectedBuildingId: null,
      selectedBuildingCode: null,
      selectedPropertyId: null,
      selectedCompanyId: null,
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
    (companyId: string) => selectionState.selectedCompanyId === companyId,
    [selectionState.selectedCompanyId]
  )

  return {
    selectionState,
    isPropertyInHierarchy,
    isBuildingInHierarchy,
    isResidenceSelected,
    isCompanyInHierarchy,
  }
}
