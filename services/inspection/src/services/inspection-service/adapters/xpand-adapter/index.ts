import knex from 'knex'
import { logger } from '@onecore/utilities'
import Config from '../../../../common/config'
import { AdapterResult } from '../../types'
import { XpandInspection, XpandInspectionSchema } from '../../schemas'
import { trimStrings } from './utils'

export interface XpandDbInspection {
  id: string
  status: number
  date: Date
  inspector: string
  type: string
  address: string
  apartmentCode: string
  leaseId: string
}

const STATUS_MAP: Record<number, string> = {
  0: 'Registrerad',
  1: 'Genomförd',
  3: 'Besiktningsresultat skickat',
  6: 'Makulerad',
} as const

export const db = knex({
  client: 'mssql',
  connection: Config.xpandDatabase,
  pool: {
    min: 0,
    max: 20,
    idleTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
  },
})

export async function getInspectionsFromXpand({
  skip = 0,
  limit = 100,
  sortAscending,
}: { skip?: number; limit?: number; sortAscending?: boolean } = {}): Promise<
  AdapterResult<XpandInspection[], 'schema-error' | 'unknown'>
> {
  logger.info(`Getting inspections from Xpand`)

  const inspections = await db<XpandDbInspection>('lbbes')
    .select(
      'lbbes.caption AS id',
      'lbbes.status AS status',
      'lbbes.besdat AS date',
      'cmctc.cmctcben AS inspector',
      'lbbka.caption AS type',
      'babuf.caption AS address',
      'babuf.lghcode AS apartmentCode',
      'hyobj.hyobjben AS leaseId'
    )
    .innerJoin('babuf', 'lbbes.keycmobj', 'babuf.keycmobj')
    .innerJoin('cmctc', 'lbbes.keycmctc', 'cmctc.keycmctc')
    .innerJoin('hyobj', 'lbbes.keyhyobj', 'hyobj.keyhyobj')
    .innerJoin('lbbka', 'lbbes.KEYLBBKA', 'lbbka.KEYLBBKA')
    .whereNot('lbbes.status', 6)
    .orderBy('lbbes.besdat', sortAscending ? 'asc' : 'desc')
    .offset(skip)
    .limit(limit)
    .then<XpandDbInspection[]>(trimStrings)

  const inspectionsWithMappedStatus = inspections.map((inspection: any) => ({
    ...inspection,
    status: STATUS_MAP[inspection.status as number] ?? `Unknown (${inspection.status})`,
  }))

  const parsed = XpandInspectionSchema.array().safeParse(inspectionsWithMappedStatus)
  if (!parsed.success) {
    logger.error(
      { error: parsed.error.format() },
      'Failed to parse inspections from Xpand DB'
    )
    return { ok: false, err: 'schema-error' }
  }

  return {
    ok: true,
    data: parsed.data,
  }
}
