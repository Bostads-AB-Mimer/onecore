import { logger } from '@onecore/utilities'
import type { RentalObjectTypeChange } from '@onecore/types'
import {
  getRentalObjectTypeChanges,
  syncRentalObjectType,
} from '../../adapters/leasing-adapter'
import { PermanentSyncError, runCmlogSync } from '../shared/run-cmlog-sync'

const DEFAULT_STATE_FILE = '/data/last-timestamp-rental-object-types.txt'
const DEFAULT_QUEUE_FILE = '/data/failed-rows.jsonl'

const quotedCode = (change: RentalObjectTypeChange): string =>
  `'${change.code ?? ''}'`

const syncChange = async (change: RentalObjectTypeChange): Promise<void> => {
  const result = await syncRentalObjectType(
    change.rentalObjectCode,
    change.code
  )
  if (result.ok) {
    logger.info(
      {
        rentalObjectCode: change.rentalObjectCode,
        code: change.code,
        action: result.data.action,
      },
      'rental object type synced'
    )
    return
  }
  if (result.err === 'unknown-type') {
    throw new PermanentSyncError(
      `Tenfast har ingen hyresobjektstyp ${quotedCode(change)}. Om Tenfast ska få typen behöver den läggas till i TENFAST_RENTAL_OBJECT_CATEGORIES i leasing-tjänsten.`
    )
  }
  if (result.err === 'rejected') {
    throw new PermanentSyncError(
      `Tenfast avvisade hyresobjektstyp ${quotedCode(change)}. Kontrollera hyresobjektet i Tenfast och ändra typen i Xpand på nytt när det är rättat.`
    )
  }
  throw new Error(`${result.err} (status ${result.statusCode ?? 'none'})`)
}

export const syncRentalObjectTypes = (
  opts: { stateFile?: string; queueFile?: string; now?: () => Date } = {}
) =>
  runCmlogSync<RentalObjectTypeChange>(
    {
      name: 'sync-rental-object-types',
      entryType: 'rental-object-type',
      firstRun: 'now',
      fetchChanges: (since) =>
        since
          ? getRentalObjectTypeChanges(since)
          : Promise.resolve({ ok: true, data: [] }),
      sync: syncChange,
      keyFor: (change) => `rental-object-type:${change.rentalObjectCode}`,
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
      now: opts.now,
    }
  )

if (require.main === module) {
  syncRentalObjectTypes().catch((err) => {
    logger.error({ err }, 'sync-rental-object-types script failed')
    process.exitCode = 1
  })
}
