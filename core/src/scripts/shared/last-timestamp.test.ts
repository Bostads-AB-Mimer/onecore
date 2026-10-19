import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { getLastTimestamp, saveLastTimestamp } from './last-timestamp'

let dir: string
let stateFile: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'last-timestamp-'))
  stateFile = path.join(dir, 'last-timestamp.txt')
})

afterEach(() => fs.rm(dir, { recursive: true, force: true }))

describe('last-timestamp', () => {
  it('reads back what it saved', async () => {
    const ts = new Date('2026-10-15T08:08:28.997Z')

    await saveLastTimestamp(stateFile, ts)

    expect(await getLastTimestamp(stateFile)).toEqual(ts)
    expect(await fs.readFile(stateFile, 'utf-8')).toBe(ts.toISOString())
  })

  it('returns null for a missing file', async () => {
    expect(await getLastTimestamp(stateFile)).toBeNull()
  })

  it('returns null for an empty or invalid file', async () => {
    await fs.writeFile(stateFile, '  \n', 'utf-8')
    expect(await getLastTimestamp(stateFile)).toBeNull()

    await fs.writeFile(stateFile, 'not-a-date', 'utf-8')
    expect(await getLastTimestamp(stateFile)).toBeNull()
  })
})
