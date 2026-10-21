import fs from 'fs/promises'

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

export const saveLastTimestamp = async (stateFile: string, ts: Date) => {
  const tmp = `${stateFile}.tmp`
  await fs.writeFile(tmp, ts.toISOString(), 'utf-8')
  await fs.rename(tmp, stateFile)
}
