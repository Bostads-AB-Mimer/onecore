import type { components as apiTypes } from '@/services/api/core/generated/api-types'
import type { ComponentSubtype } from '@/services/types'

import type { ComponentType as ActionComponentType } from '../constants/actions'
import {
  SURFACE_CODES,
  SURFACE_LABELS,
  type SurfaceCode,
} from '../constants/components'

type FetchedComponent = apiTypes['schemas']['Component']

export interface SurfaceSubtypeOption {
  subtypeId: string
  subtypeName: string
}

export interface SurfaceGroup {
  typeName: string
  subtypes: SurfaceSubtypeOption[]
}

const isSurfaceCode = (code: unknown): code is SurfaceCode =>
  SURFACE_CODES.includes(code as SurfaceCode)

export const getSurfaceCode = (
  component: FetchedComponent
): SurfaceCode | undefined => {
  const code = component.subtype?.componentType?.code
  return isSurfaceCode(code) ? code : undefined
}

export const toActionComponentType = (
  code: string | null | undefined
): ActionComponentType => {
  switch (code) {
    case 'WALL':
      return 'walls'
    case 'FLOOR':
      return 'floor'
    case 'CEILING':
      return 'ceiling'
    default:
      return 'details'
  }
}

export const findMissingSurfaces = (
  components: FetchedComponent[]
): SurfaceCode[] =>
  SURFACE_CODES.filter(
    (code) => !components.some((c) => getSurfaceCode(c) === code)
  )

const isUnspecified = (option: SurfaceSubtypeOption) =>
  option.subtypeName.startsWith('Ospecificera')

const bySubtypeNameUnspecifiedFirst = (
  a: SurfaceSubtypeOption,
  b: SurfaceSubtypeOption
) =>
  Number(isUnspecified(b)) - Number(isUnspecified(a)) ||
  a.subtypeName.localeCompare(b.subtypeName)

export const groupSurfaceSubtypes = (
  subtypes: ComponentSubtype[]
): Map<SurfaceCode, SurfaceGroup> => {
  const groups = new Map<SurfaceCode, SurfaceGroup>()
  const seen = new Set<string>()

  for (const subtype of subtypes) {
    const code = subtype.componentType?.code
    if (!subtype.id || !subtype.subTypeName || !isSurfaceCode(code)) continue
    if (seen.has(subtype.id)) continue
    seen.add(subtype.id)

    const group = groups.get(code) ?? {
      typeName: subtype.componentType?.typeName ?? SURFACE_LABELS[code],
      subtypes: [],
    }
    group.subtypes.push({
      subtypeId: subtype.id,
      subtypeName: subtype.subTypeName,
    })
    groups.set(code, group)
  }

  for (const group of groups.values()) {
    group.subtypes.sort(bySubtypeNameUnspecifiedFirst)
  }

  return groups
}

export const surfaceLabel = (
  code: SurfaceCode,
  groups: Map<SurfaceCode, SurfaceGroup>
): string => groups.get(code)?.typeName ?? SURFACE_LABELS[code]
