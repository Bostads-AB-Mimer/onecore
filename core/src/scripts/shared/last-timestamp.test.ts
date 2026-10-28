import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import {
  getLastTimestamp,
  readSyncPosition,
  saveSyncPosition,
} from './last-timestamp'

let dir: string
let stateFile: string
let positionFile: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'last-timestamp-'))
  stateFile = path.join(dir, 'last-timestamp.txt')
  positionFile = `${stateFile}.position.json`
})

afterEach(() => fs.rm(dir, { recursive: true, force: true }))

const position = {
  timestamp: new Date('2026-10-15T08:08:28.000Z'),
  readFrom: new Date('2026-10-15T08:03:28.000Z'),
  handled: new Map([
    ['thing:A-1#abc', new Date('2026-10-15T08:05:00.000Z').getTime()],
    ['thing:A-2#def', new Date('2026-10-15T08:08:28.000Z').getTime()],
  ]),
}

describe('sync position', () => {
  it('reads back what it saved', async () => {
    await saveSyncPosition(stateFile, position)

    expect(await readSyncPosition(stateFile)).toEqual(position)
  })

  it('keeps the timestamp file a bare timestamp that older code reads', async () => {
    await saveSyncPosition(stateFile, position)

    expect(await fs.readFile(stateFile, 'utf-8')).toBe(
      '2026-10-15T08:08:28.000Z'
    )
    expect(await getLastTimestamp(stateFile)).toEqual(position.timestamp)
  })

  it('saves a position without a timestamp and writes no timestamp file', async () => {
    const empty = { ...position, timestamp: null }

    await saveSyncPosition(stateFile, empty)

    expect(await getLastTimestamp(stateFile)).toBeNull()
    expect(await readSyncPosition(stateFile)).toEqual(empty)
  })

  it('reads a bare timestamp file as everything up to that second handled', async () => {
    await fs.writeFile(stateFile, '2026-10-15T08:08:28.000Z', 'utf-8')

    expect(await readSyncPosition(stateFile)).toEqual({
      timestamp: new Date('2026-10-15T08:08:28.000Z'),
      readFrom: new Date('2026-10-15T08:08:29.000Z'),
      handled: new Map(),
    })
  })

  it('ignores a position file that no longer matches the timestamp file', async () => {
    await saveSyncPosition(stateFile, position)
    await fs.writeFile(stateFile, '2026-10-15T09:00:00.000Z', 'utf-8')

    expect(await readSyncPosition(stateFile)).toEqual({
      timestamp: new Date('2026-10-15T09:00:00.000Z'),
      readFrom: new Date('2026-10-15T09:00:01.000Z'),
      handled: new Map(),
    })
  })

  it('uses a position file saved ahead of the timestamp file', async () => {
    await fs.writeFile(stateFile, '2026-10-15T08:00:00.000Z', 'utf-8')
    await saveSyncPosition(stateFile, { ...position, timestamp: null })
    await fs.writeFile(
      positionFile,
      (await fs.readFile(positionFile, 'utf-8')).replace(
        '"timestamp":null',
        `"timestamp":"${position.timestamp.toISOString()}"`
      ),
      'utf-8'
    )

    expect(await readSyncPosition(stateFile)).toEqual(position)
  })

  it('uses a position file when the timestamp file was never written', async () => {
    await saveSyncPosition(stateFile, position)
    await fs.rm(stateFile)

    expect(await readSyncPosition(stateFile)).toEqual(position)
  })

  it('ignores a position file without a timestamp once the timestamp file has one', async () => {
    await saveSyncPosition(stateFile, { ...position, timestamp: null })
    await fs.writeFile(stateFile, '2026-10-15T08:00:00.000Z', 'utf-8')

    expect((await readSyncPosition(stateFile))?.handled).toEqual(new Map())
  })

  it('ignores an unreadable position file', async () => {
    await fs.writeFile(stateFile, '2026-10-15T08:08:28.000Z', 'utf-8')
    await fs.writeFile(positionFile, '{"timestamp":', 'utf-8')

    expect((await readSyncPosition(stateFile))?.readFrom).toEqual(
      new Date('2026-10-15T08:08:29.000Z')
    )
  })

  it('returns null when neither file exists', async () => {
    expect(await readSyncPosition(stateFile)).toBeNull()
  })

  it('throws for an empty or invalid timestamp file', async () => {
    await fs.writeFile(stateFile, '  \n', 'utf-8')
    await expect(readSyncPosition(stateFile)).rejects.toThrow(stateFile)

    await fs.writeFile(stateFile, 'not-a-date', 'utf-8')
    await expect(readSyncPosition(stateFile)).rejects.toThrow(stateFile)
  })

  it('throws when the file cannot be read', async () => {
    await fs.mkdir(stateFile)

    await expect(readSyncPosition(stateFile)).rejects.toThrow()
  })
})
