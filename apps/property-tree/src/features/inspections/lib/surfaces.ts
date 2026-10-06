import type { components as apiTypes } from '@/services/api/core/generated/api-types'
import type { ComponentModel } from '@/services/types'

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
  representativeModelId: string
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
  const code = component.model?.subtype?.componentType?.code
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

const pickRepresentativeModel = (models: ComponentModel[]): ComponentModel => {
  const subTypeName = models[0]?.subtype?.subTypeName ?? ''
  return (
    models.find((m) => m.modelName === subTypeName) ??
    [...models].sort((a, b) => a.modelName.localeCompare(b.modelName))[0]
  )
}

export const groupSurfaceModels = (
  models: ComponentModel[]
): Map<SurfaceCode, SurfaceGroup> => {
  const bySubtype = new Map<string, ComponentModel[]>()
  for (const model of models) {
    const subtypeId = model.subtype?.id
    if (!subtypeId) continue
    const bucket = bySubtype.get(subtypeId)
    if (bucket) {
      bucket.push(model)
    } else {
      bySubtype.set(subtypeId, [model])
    }
  }

  const groups = new Map<SurfaceCode, SurfaceGroup>()
  for (const subtypeModels of bySubtype.values()) {
    const first = subtypeModels[0]
    const componentType = first.subtype?.componentType
    const code = componentType?.code
    const subtypeId = first.subtype?.id
    const subtypeName = first.subtype?.subTypeName
    if (!isSurfaceCode(code) || !subtypeId || !subtypeName) continue

    const group = groups.get(code) ?? {
      typeName: componentType?.typeName ?? SURFACE_LABELS[code],
      subtypes: [],
    }
    group.subtypes.push({
      subtypeId,
      subtypeName,
      representativeModelId: pickRepresentativeModel(subtypeModels).id,
    })
    groups.set(code, group)
  }

  for (const group of groups.values()) {
    group.subtypes.sort((a, b) => a.subtypeName.localeCompare(b.subtypeName))
  }

  return groups
}

export const surfaceLabel = (
  code: SurfaceCode,
  groups: Map<SurfaceCode, SurfaceGroup>
): string => groups.get(code)?.typeName ?? SURFACE_LABELS[code]
