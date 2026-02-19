import { useCallback, useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { useBuilding } from '@/features/buildings'
import { useCompanyByPropertyId } from '@/features/companies'
import { useProperty } from '@/features/properties'
import { useResidence } from '@/features/residences'

import { matchesRoute, routes } from '@/shared/routes'

interface LocationState {
  organizationNumber?: string
  propertyCode?: string
  buildingCode?: string
}

interface SelectionState {
  selectedResidenceId: string | null
  selectedBuildingCode: string | null
  selectedPropertyCode: string | null
  selectedOrganizationNumber: string | null
}

export function useHierarchicalSelection() {
  const { pathname, state: rawState } = useLocation()
  const params = useParams()
  const state = (rawState ?? {}) as LocationState

  // Which route are we on?
  const onResidence = matchesRoute(routes.residence, pathname)
  const onBuilding = matchesRoute(routes.building, pathname)
  const onProperty = matchesRoute(routes.property, pathname)
  const onCompany = matchesRoute(routes.company, pathname)

  // Fetch the directly selected entity to resolve its ancestors
  const { data: residence } = useResidence(
    onResidence ? params.rentalId : undefined
  )
  const { data: building } = useBuilding(
    onBuilding ? params.buildingCode : undefined
  )

  // Resolve each level: use route param if directly selected,
  // otherwise fall back to navigation state → fetched data
  const selectedResidenceId = onResidence ? (params.rentalId ?? null) : null

  const selectedBuildingCode = onBuilding
    ? (params.buildingCode ?? null)
    : (state.buildingCode ?? residence?.building?.code ?? null)

  const selectedPropertyCode = onProperty
    ? (params.propertyCode ?? null)
    : (state.propertyCode ??
      building?.property?.code ??
      residence?.property?.code ??
      null)

  // Company requires a property fetch to resolve
  const { data: property } = useProperty(
    !state.organizationNumber && selectedPropertyCode ? selectedPropertyCode : undefined
  )
  const { data: company } = useCompanyByPropertyId(
    !state.organizationNumber ? property?.id : undefined
  )

  const selectedOrganizationNumber = onCompany
    ? (params.organizationNumber ?? null)
    : (state.organizationNumber ?? company?.organizationNumber ?? null)

  const selectionState = useMemo(
    (): SelectionState => ({
      selectedResidenceId,
      selectedBuildingCode,
      selectedPropertyCode,
      selectedOrganizationNumber,
    }),
    [
      selectedResidenceId,
      selectedBuildingCode,
      selectedPropertyCode,
      selectedOrganizationNumber,
    ]
  )

  const isPropertyInHierarchy = useCallback(
    (code: string) => selectedPropertyCode === code,
    [selectedPropertyCode]
  )

  const isBuildingInHierarchy = useCallback(
    (code: string) => selectedBuildingCode === code,
    [selectedBuildingCode]
  )

  const isResidenceSelected = useCallback(
    (id: string) => selectedResidenceId === id,
    [selectedResidenceId]
  )

  const isCompanyInHierarchy = useCallback(
    (orgNr: string) => selectedOrganizationNumber === orgNr,
    [selectedOrganizationNumber]
  )

  return {
    selectionState,
    isPropertyInHierarchy,
    isBuildingInHierarchy,
    isResidenceSelected,
    isCompanyInHierarchy,
  }
}
