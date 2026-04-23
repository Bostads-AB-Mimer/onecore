import fs from 'fs/promises'
import { logger } from '@onecore/utilities'
import config from '../common/config'
import { createXpandDbClient } from '../adapters/xpand/db'

const STATE_FILE = '/data/last-timestamp.txt'
const FALLBACK_MINUTES = 5

const getLastTimestamp = async (): Promise<Date | null> => {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8')
    const trimmed = content.trim()
    if (!trimmed) return null
    const date = new Date(trimmed)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

const saveLastTimestamp = async (ts: Date) => {
  await fs.writeFile(STATE_FILE, ts.toISOString(), 'utf-8')
}

const syncContacts = async () => {
  const db = createXpandDbClient(config.xpandDatabase)

  try {
    const lastTimestamp = await getLastTimestamp()

    let rows: Record<string, unknown>[]
    if (lastTimestamp) {
      logger.info({ lastTimestamp }, 'syncing contacts since last timestamp')
      rows = await db.raw(
        `SELECT * FROM cmlog WHERE logtime > ? ORDER BY logtime ASC`,
        [lastTimestamp]
      )
    } else {
      logger.info(
        { fallbackMinutes: FALLBACK_MINUTES },
        'no saved timestamp, using fallback window'
      )
      rows = await db.raw(
        `SELECT * FROM cmlog WHERE logtime >= DATEADD(minute, -${FALLBACK_MINUTES}, GETDATE()) ORDER BY logtime ASC`
      )
    }

    logger.info({ count: rows.length }, 'sync contacts result')

    if (rows.length > 0) {
      for (const row of rows) {
        logger.info(row, 'cmlog row')
      }

      const maxLogtime = rows.reduce<Date>(
        (max, row) => {
          const t = new Date(row['logtime'] as string)
          return t > max ? t : max
        },
        new Date(rows[0]['logtime'] as string)
      )

      await saveLastTimestamp(maxLogtime)
      logger.info({ savedTimestamp: maxLogtime }, 'saved last timestamp')
    }
  } catch (err) {
    logger.error(err, 'Failed to sync contaacts')
    throw err
  } finally {
    await db.destroy()
  }
}

syncContacts()
