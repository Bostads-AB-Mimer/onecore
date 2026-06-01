import fs from 'fs/promises'
import { logger } from '@onecore/utilities'

export type FailedRowEntry = {
  key: string
  type: 'lease' | 'contact'
  payload: unknown
  addedAt: string
  lastError: string
}

export const readQueue = async (path: string): Promise<FailedRowEntry[]> => {
  let content: string
  try {
    content = await fs.readFile(path, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    logger.warn(
      { err, path },
      'failed-sync-queue: read error, treating as empty'
    )
    return []
  }
  try {
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as FailedRowEntry)
  } catch (err) {
    logger.warn(
      { err, path },
      'failed-sync-queue: unable to parse queue file, treating as empty'
    )
    return []
  }
}

const writeQueueAtomic = async (
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

export const addEntry = async (
  path: string,
  entry: FailedRowEntry
): Promise<void> => {
  const queue = await readQueue(path)
  if (queue.some((e) => e.key === entry.key)) return
  queue.push(entry)
  await writeQueueAtomic(path, queue)
}

export const removeEntry = async (path: string, key: string): Promise<void> => {
  const queue = await readQueue(path)
  const filtered = queue.filter((e) => e.key !== key)
  if (filtered.length === queue.length) return
  await writeQueueAtomic(path, filtered)
}

export const hasKey = (queue: FailedRowEntry[], key: string): boolean =>
  queue.some((e) => e.key === key)
