import { logger } from '@onecore/utilities'
import type { RentalObjectTypeChange } from '@onecore/types'
import {
  getRentalObjectTypeChanges,
  syncRentalObjectType,
} from '../../adapters/leasing-adapter'
import { runCmlogSync, SyncOutcome } from '../shared/run-cmlog-sync'

const DEFAULT_STATE_FILE = '/data/last-timestamp-rental-object-types.txt'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'

const quotedCode = (change: RentalObjectTypeChange): string =>
  `'${change.code ?? ''}'`

const syncChange = async (
  change: RentalObjectTypeChange
): Promise<SyncOutcome> => {
  const result = await syncRentalObjectType(
    change.rentalObjectCode,
    change.code
  )
  if (!result.ok) {
    throw new Error(
      `Failed to sync rental object type ${quotedCode(change)} for ${change.rentalObjectCode}: ${result.err}`
    )
  }
  logger.info(
    {
      rentalObjectCode: change.rentalObjectCode,
      code: change.code,
      action: result.data.action,
    },
    'rental object type synced'
  )
  if (result.data.action === 'skipped')
    return { skipped: 'hyresobjektet finns inte i Tenfast' }
}

export const syncRentalObjectTypes = (
  opts: { stateFile?: string; queueFile?: string } = {}
) =>
  runCmlogSync<RentalObjectTypeChange>(
    {
      name: 'sync-rental-object-types',
      entryType: 'rental-object-type',
      fetchChanges: async (since) => {
        const result = await getRentalObjectTypeChanges(since)
        if (!result.ok) return result
        return {
          ok: true,
          data: result.data.changes,
          until: result.data.until ?? undefined,
        }
      },
      sync: syncChange,
      keyFor: (change) =>
        `${change.rentalObjectCode}:${change.timestamp.toISOString()}`,
      supersedeKey: (change) => change.rentalObjectCode,
      timestampOf: (change) => change.timestamp,
      toPayload: (change) => ({
        ...change,
        timestamp: change.timestamp.toISOString(),
      }),
      fromPayload: (payload) => {
        const p = payload as Omit<RentalObjectTypeChange, 'timestamp'> & {
          timestamp: string
        }
        return { ...p, timestamp: new Date(p.timestamp) }
      },
      describe: (change) => ({
        subject: `hyresobjekt ${change.rentalObjectCode}`,
        detail: `hyresobjekt ${change.rentalObjectCode} (hyresobjektstyp ${quotedCode(change)})`,
      }),
    },
    {
      stateFile: opts.stateFile ?? DEFAULT_STATE_FILE,
      queueFile: opts.queueFile ?? DEFAULT_QUEUE_FILE,
    }
  )

if (require.main === module) {
  syncRentalObjectTypes().catch((err) => {
    logger.error({ err }, 'sync-rental-object-types script failed')
    process.exitCode = 1
  })
}
