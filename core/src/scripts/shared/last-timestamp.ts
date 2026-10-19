import fs from 'fs/promises'

export const getLastTimestamp = async (
  stateFile: string
): Promise<Date | null> => {
  try {
    const content = await fs.readFile(stateFile, 'utf-8')
    const trimmed = content.trim()
    if (!trimmed) return null
    const date = new Date(trimmed)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

export const saveLastTimestamp = async (stateFile: string, ts: Date) => {
  const tmp = `${stateFile}.tmp`
  await fs.writeFile(tmp, ts.toISOString(), 'utf-8')
  await fs.rename(tmp, stateFile)
}
