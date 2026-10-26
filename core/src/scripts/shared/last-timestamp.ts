import fs from 'fs/promises'

/**
 * Where a sync left off: the logtime of the last cmlog second it finished,
 * and the keys of the changes it handled in that second. cmlog has whole
 * seconds, so the next run reads that second again and uses the keys to
 * skip what it already did.
 */
export type SyncPosition = { timestamp: Date; handled: string[] }

const parsePosition = (content: string): SyncPosition | null => {
  const text = content.trim()
  // Files written before handled keys existed hold a bare ISO timestamp.
  if (!text.startsWith('{')) {
    const date = new Date(text)
    return isNaN(date.getTime()) ? null : { timestamp: date, handled: [] }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const { timestamp, handled } = raw as Record<string, unknown>
  if (typeof timestamp !== 'string') return null
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return null
  if (!Array.isArray(handled) || handled.some((k) => typeof k !== 'string'))
    return null
  return { timestamp: date, handled }
}

export const readPosition = async (
  stateFile: string
): Promise<SyncPosition | null> => {
  let content: string
  try {
    content = await fs.readFile(stateFile, 'utf-8')
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return null
    throw err
  }
  const position = parsePosition(content)
  if (!position)
    throw new Error(`${stateFile} holds no sync position: '${content.trim()}'`)
  return position
}

export const savePosition = async (
  stateFile: string,
  position: SyncPosition
) => {
  const tmp = `${stateFile}.tmp`
  await fs.writeFile(
    tmp,
    JSON.stringify({
      timestamp: position.timestamp.toISOString(),
      handled: position.handled,
    }),
    'utf-8'
  )
  await fs.rename(tmp, stateFile)
}
