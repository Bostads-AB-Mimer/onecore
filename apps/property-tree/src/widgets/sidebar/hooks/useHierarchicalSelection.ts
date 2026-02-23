import { useCallback, useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { useBuilding } from '@/features/buildings'
import { useCompanyByPropertyId } from '@/features/companies'
import { useProperty } from '@/features/properties'
import { useResidence } from '@/features/residences'

import { matchesRoute, routes } from '@/shared/routes'

// --- Types ---

interface LocationState {
  companyId?: string
  propertyCode?: string
  buildingCode?: string
  staircaseCode?: string
}

type RouteContext =
  | { route: 'residence'; residenceId: string; state: LocationState }
  | { route: 'building'; buildingCode: string; state: LocationState }
  | { route: 'property'; propertyCode: string; state: LocationState }
  | { route: 'company'; companyId: string; state: LocationState }
  | { route: 'other'; state: LocationState }

interface SelectionState {
  selectedResidenceId: string | null
  selectedBuildingCode: string | null
  selectedPropertyCode: string | null
  selectedCompanyId: string | null
}

// --- Phase 1: Route Parsing ---

function useRouteContext(): RouteContext {
  const location = useLocation()
  const params = useParams()
  const state = (location.state ?? {}) as LocationState
  const path = location.pathname

  if (matchesRoute(routes.residence, path) && params.residenceId) {
    return { route: 'residence', residenceId: params.residenceId, state }
  }
  if (matchesRoute(routes.building, path) && params.buildingCode) {
    return { route: 'building', buildingCode: params.buildingCode, state }
  }
  if (matchesRoute(routes.property, path) && params.propertyCode) {
    return { route: 'property', propertyCode: params.propertyCode, state }
  }
  if (matchesRoute(routes.company, path) && params.companyId) {
    return { route: 'company', companyId: params.companyId, state }
  }
  return { route: 'other', state }
}

// --- Phase 2: Data Fetching ---

interface HierarchyData {
  residenceId: string | null
  buildingCode: string | null
  propertyCode: string | null
  companyId: string | null
}

function useHierarchyData(ctx: RouteContext): HierarchyData {
  const residenceQuery = ctx.route === 'residence' ? ctx.residenceId : undefined
  const { data: residence } = useResidence(residenceQuery)

  const buildingQuery = ctx.route === 'building' ? ctx.buildingCode : undefined
  const { data: building } = useBuilding(buildingQuery)

  const propertyCodeForQuery = (() => {
    if (ctx.state.companyId) return undefined
    switch (ctx.route) {
      case 'property':
        return ctx.propertyCode
      case 'building':
        return (
          ctx.state.propertyCode ?? building?.property?.code ?? undefined
        )
      case 'residence':
        return (
          ctx.state.propertyCode ?? residence?.property?.code ?? undefined
        )
      default:
        return undefined
    }
  })()
  const { data: property } = useProperty(propertyCodeForQuery)

  const companyPropertyId =
    property && !ctx.state.companyId ? property.id : undefined
  const { data: company } = useCompanyByPropertyId(companyPropertyId)

  const companyId = ctx.state.companyId ?? company?.id ?? null

  switch (ctx.route) {
    case 'residence':
      return {
        residenceId: ctx.residenceId,
        buildingCode:
          ctx.state.buildingCode ?? residence?.building?.code ?? null,
        propertyCode:
          ctx.state.propertyCode ?? residence?.property?.code ?? null,
        companyId,
      }
    case 'building':
      return {
        residenceId: null,
        buildingCode: ctx.buildingCode,
        propertyCode:
          ctx.state.propertyCode ?? building?.property?.code ?? null,
        companyId,
      }
    case 'property':
      return {
        residenceId: null,
        buildingCode: null,
        propertyCode: ctx.propertyCode,
        companyId,
      }
    case 'company':
      return {
        residenceId: null,
        buildingCode: null,
        propertyCode: null,
        companyId: ctx.companyId,
      }
    default:
      return {
        residenceId: null,
        buildingCode: null,
        propertyCode: null,
        companyId: null,
      }
  }
}

// --- Phase 3: Main Hook ---

export function useHierarchicalSelection() {
  const ctx = useRouteContext()
  const hierarchy = useHierarchyData(ctx)

  const selectionState = useMemo(
    (): SelectionState => ({
      selectedResidenceId: hierarchy.residenceId,
      selectedBuildingCode: hierarchy.buildingCode,
      selectedPropertyCode: hierarchy.propertyCode,
      selectedCompanyId: hierarchy.companyId,
    }),
    [
      hierarchy.residenceId,
      hierarchy.buildingCode,
      hierarchy.propertyCode,
      hierarchy.companyId,
    ]
  )

  const isPropertyInHierarchy = useCallback(
    (propertyCode: string) =>
      selectionState.selectedPropertyCode === propertyCode,
    [selectionState.selectedPropertyCode]
  )

  const isBuildingInHierarchy = useCallback(
    (buildingCode: string) =>
      selectionState.selectedBuildingCode === buildingCode,
    [selectionState.selectedBuildingCode]
  )

  const isResidenceSelected = useCallback(
    (residenceId: string) =>
      selectionState.selectedResidenceId === residenceId,
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
