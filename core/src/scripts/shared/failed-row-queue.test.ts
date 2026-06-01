import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import {
  readQueue,
  addEntry,
  removeEntry,
  hasKey,
  FailedRowEntry,
} from './failed-row-queue'

let dir: string
let file: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'frq-'))
  file = path.join(dir, 'failed-rows.jsonl')
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

const makeEntry = (key: string): FailedRowEntry => ({
  key,
  type: 'lease',
  payload: { foo: 'bar' },
  addedAt: '2026-06-01T00:00:00.000Z',
  lastError: 'oops',
})

describe('failed-row-queue', () => {
  it('readQueue returns [] when file is missing', async () => {
    expect(await readQueue(file)).toEqual([])
  })

  it('addEntry persists and readQueue round-trips', async () => {
    await addEntry(file, makeEntry('a'))
    expect(await readQueue(file)).toEqual([makeEntry('a')])
  })

  it('addEntry is idempotent on duplicate key', async () => {
    await addEntry(file, makeEntry('a'))
    await addEntry(file, { ...makeEntry('a'), lastError: 'different' })
    const q = await readQueue(file)
    expect(q).toHaveLength(1)
    expect(q[0].lastError).toBe('oops')
  })

  it('addEntry preserves insertion order', async () => {
    await addEntry(file, makeEntry('a'))
    await addEntry(file, makeEntry('b'))
    await addEntry(file, makeEntry('c'))
    const q = await readQueue(file)
    expect(q.map((e) => e.key)).toEqual(['a', 'b', 'c'])
  })

  it('removeEntry removes by key', async () => {
    await addEntry(file, makeEntry('a'))
    await addEntry(file, makeEntry('b'))
    await removeEntry(file, 'a')
    const q = await readQueue(file)
    expect(q.map((e) => e.key)).toEqual(['b'])
  })

  it('removeEntry is a no-op when key is absent', async () => {
    await addEntry(file, makeEntry('a'))
    await removeEntry(file, 'never-existed')
    expect(await readQueue(file)).toHaveLength(1)
  })

  it('readQueue on corrupted file returns [] without throwing', async () => {
    await fs.writeFile(file, '{this is not json', 'utf-8')
    expect(await readQueue(file)).toEqual([])
  })

  it('hasKey returns true / false correctly', () => {
    const q = [makeEntry('a'), makeEntry('b')]
    expect(hasKey(q, 'a')).toBe(true)
    expect(hasKey(q, 'c')).toBe(false)
  })
})
