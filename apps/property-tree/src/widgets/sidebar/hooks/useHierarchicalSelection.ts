import { useCallback, useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { useBuilding } from '@/features/buildings'
import { useCompanyByPropertyId } from '@/features/companies'
import { useProperty } from '@/features/properties'
import { useResidence } from '@/features/residences'

import { matchesRoute, routes } from '@/shared/routes'

interface LocationState {
  companyId?: string
  propertyCode?: string
  buildingCode?: string
}

interface SelectionState {
  selectedResidenceId: string | null
  selectedBuildingCode: string | null
  selectedPropertyCode: string | null
  selectedCompanyId: string | null
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
    onResidence ? params.residenceId : undefined
  )
  const { data: building } = useBuilding(
    onBuilding ? params.buildingCode : undefined
  )

  // Resolve each level: use route param if directly selected,
  // otherwise fall back to navigation state → fetched data
  const selectedResidenceId = onResidence ? (params.residenceId ?? null) : null

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
    !state.companyId && selectedPropertyCode ? selectedPropertyCode : undefined
  )
  const { data: company } = useCompanyByPropertyId(
    !state.companyId ? property?.id : undefined
  )

  const selectedCompanyId = onCompany
    ? (params.companyId ?? null)
    : (state.companyId ?? company?.id ?? null)

  const selectionState = useMemo(
    (): SelectionState => ({
      selectedResidenceId,
      selectedBuildingCode,
      selectedPropertyCode,
      selectedCompanyId,
    }),
    [
      selectedResidenceId,
      selectedBuildingCode,
      selectedPropertyCode,
      selectedCompanyId,
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
    (id: string) => selectedCompanyId === id,
    [selectedCompanyId]
  )

  return {
    selectionState,
    isPropertyInHierarchy,
    isBuildingInHierarchy,
    isResidenceSelected,
    isCompanyInHierarchy,
  }
}
