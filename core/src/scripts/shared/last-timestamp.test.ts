import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { readPosition, savePosition } from './last-timestamp'

let dir: string
let stateFile: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'last-timestamp-'))
  stateFile = path.join(dir, 'last-timestamp.txt')
})

afterEach(() => fs.rm(dir, { recursive: true, force: true }))

describe('sync position', () => {
  it('reads back what it saved', async () => {
    const position = {
      timestamp: new Date('2026-10-15T08:08:28.000Z'),
      handled: ['thing:A-1', 'thing:A-2'],
    }

    await savePosition(stateFile, position)

    expect(await readPosition(stateFile)).toEqual(position)
    expect(JSON.parse(await fs.readFile(stateFile, 'utf-8'))).toEqual({
      timestamp: '2026-10-15T08:08:28.000Z',
      handled: ['thing:A-1', 'thing:A-2'],
    })
  })

  it('reads a file saved before handled keys existed as a bare timestamp', async () => {
    await fs.writeFile(stateFile, '2026-10-15T08:08:28.997Z', 'utf-8')

    expect(await readPosition(stateFile)).toEqual({
      timestamp: new Date('2026-10-15T08:08:28.997Z'),
      handled: [],
    })
  })

  it('returns null for a missing file', async () => {
    expect(await readPosition(stateFile)).toBeNull()
  })

  it('throws for an empty or invalid file', async () => {
    await fs.writeFile(stateFile, '  \n', 'utf-8')
    await expect(readPosition(stateFile)).rejects.toThrow(stateFile)

    await fs.writeFile(stateFile, 'not-a-date', 'utf-8')
    await expect(readPosition(stateFile)).rejects.toThrow(stateFile)

    await fs.writeFile(stateFile, '{"timestamp":"nope","handled":[]}', 'utf-8')
    await expect(readPosition(stateFile)).rejects.toThrow(stateFile)

    await fs.writeFile(
      stateFile,
      '{"timestamp":"2026-10-15T08:08:28.000Z"}',
      'utf-8'
    )
    await expect(readPosition(stateFile)).rejects.toThrow(stateFile)
  })

  it('throws when the file cannot be read', async () => {
    await fs.mkdir(stateFile)

    await expect(readPosition(stateFile)).rejects.toThrow()
  })
})
