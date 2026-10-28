import fs from 'fs/promises'
import { logger } from '@onecore/utilities'

export type FailedRowEntry = {
  key: string
  type: 'lease' | 'contact' | 'rental-object-type'
  payload: unknown
  addedAt: string
  lastError: string
  lastAttemptAt?: string
  retriesStartedAt?: string
  stillFailingNotifiedAt?: string
  undoFailedNotifiedAt?: string
}

export const readQueue = async (path: string): Promise<FailedRowEntry[]> => {
  let content: string
  try {
    content = await fs.readFile(path, 'utf-8')
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return []
    logger.warn(
      { err, path },
      'failed-sync-queue: read error, treating as empty'
    )
    return []
  }
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .flatMap((line, index) => {
      try {
        return [JSON.parse(line) as FailedRowEntry]
      } catch (err) {
        logger.warn(
          { err, path, line: index + 1 },
          'failed-sync-queue: unable to parse line, skipping it'
        )
        return []
      }
    })
}

export const writeQueue = async (
  path: string,
  queue: FailedRowEntry[]
): Promise<void> => {
  const tmp = `${path}.tmp`
  const content =
    queue.map((e) => JSON.stringify(e)).join('\n') +
    (queue.length > 0 ? '\n' : '')
  await fs.writeFile(tmp, content, 'utf-8')
  await fs.rename(tmp, path)
}

export const appendEntry = async (
  path: string,
  entry: FailedRowEntry
): Promise<void> => {
  // The leading newline ends a line torn by an earlier crashed append.
  await fs.appendFile(path, '\n' + JSON.stringify(entry) + '\n', 'utf-8')
}

export const removeEntry = async (path: string, key: string): Promise<void> => {
  const queue = await readQueue(path)
  const filtered = queue.filter((e) => e.key !== key)
  if (filtered.length === queue.length) return
  await writeQueue(path, filtered)
}
