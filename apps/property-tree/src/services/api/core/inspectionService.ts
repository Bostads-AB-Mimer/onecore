import { GET } from './base-api'
import { components } from './generated/api-types'

// export type InternalInspection = {
//   _tag: 'internal'
// } & components['schemas']['Inspection']
export type ExternalInspection = {
  _tag: 'external'
} & components['schemas']['XpandInspection']
// export type Inspection = InternalInspection | ExternalInspection
export type Inspection = ExternalInspection

export const inspectionService = {
  async getAllInspections(): Promise<Inspection[]> {
    const externalInspections = await GET('/inspections/xpand', {
      params: { query: { skip: 0, limit: 25 } },
    })

    if (externalInspections.error) throw externalInspections.error
    if (!externalInspections.data.content)
      throw new Error('No data returned from API')

    return (externalInspections.data.content.inspections ?? []).map((v) => ({
      _tag: 'external' as const,
      ...v,
    }))
  },
}
