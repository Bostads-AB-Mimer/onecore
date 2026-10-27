import fs from 'fs/promises'

const SECOND_MS = 1000

export const getLastTimestamp = async (
  stateFile: string
): Promise<Date | null> => {
  let content: string
  try {
    content = await fs.readFile(stateFile, 'utf-8')
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return null
    throw err
  }
  const date = new Date(content.trim())
  if (isNaN(date.getTime()))
    throw new Error(`${stateFile} holds no timestamp: '${content.trim()}'`)
  return date
}

const writeAtomically = async (file: string, content: string) => {
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, content, 'utf-8')
  await fs.rename(tmp, file)
}

export const saveLastTimestamp = (stateFile: string, ts: Date) =>
  writeAtomically(stateFile, ts.toISOString())

/**
 * Where a sync left off. `timestamp` is the last finished second, also kept as
 * a bare timestamp in the state file for older code. The next run reads cmlog
 * from `readFrom` and skips the rows in `handled` (id → logtime in ms).
 */
export type SyncPosition = {
  timestamp: Date | null
  readFrom: Date
  handled: Map<string, number>
}

const positionFileOf = (stateFile: string) => `${stateFile}.position.json`

const readPositionFile = async (
  stateFile: string
): Promise<SyncPosition | null> => {
  try {
    const raw = JSON.parse(
      await fs.readFile(positionFileOf(stateFile), 'utf-8')
    ) as { timestamp: string | null; readFrom: string; handled: object }
    const readFrom = new Date(raw.readFrom)
    if (isNaN(readFrom.getTime())) return null
    return {
      timestamp: raw.timestamp === null ? null : new Date(raw.timestamp),
      readFrom,
      handled: new Map(
        Object.entries(raw.handled).map(([id, at]) => [
          id,
          new Date(at).getTime(),
        ])
      ),
    }
  } catch {
    return null
  }
}

export const readSyncPosition = async (
  stateFile: string
): Promise<SyncPosition | null> => {
  const timestamp = await getLastTimestamp(stateFile)
  const position = await readPositionFile(stateFile)
  // A position file left behind by a rollback no longer matches the state file.
  if (position && position.timestamp?.getTime() === timestamp?.getTime())
    return position
  if (!timestamp) return null
  return {
    timestamp,
    readFrom: new Date(timestamp.getTime() + SECOND_MS),
    handled: new Map(),
  }
}

export const saveSyncPosition = async (
  stateFile: string,
  position: SyncPosition
) => {
  await writeAtomically(
    positionFileOf(stateFile),
    JSON.stringify({
      timestamp: position.timestamp?.toISOString() ?? null,
      readFrom: position.readFrom.toISOString(),
      handled: Object.fromEntries(
        [...position.handled].map(([id, at]) => [
          id,
          new Date(at).toISOString(),
        ])
      ),
    })
  )
  if (position.timestamp) await saveLastTimestamp(stateFile, position.timestamp)
}
