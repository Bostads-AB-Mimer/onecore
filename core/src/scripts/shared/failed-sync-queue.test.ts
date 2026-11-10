import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import {
  readQueue,
  appendEntry,
  removeEntry,
  writeQueue,
  FailedRowEntry,
} from './failed-sync-queue'

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

describe('failed-sync-queue', () => {
  it('readQueue returns [] when file is missing', async () => {
    expect(await readQueue(file)).toEqual([])
  })

  it('appendEntry persists and readQueue round-trips', async () => {
    await appendEntry(file, makeEntry('a'))
    expect(await readQueue(file)).toEqual([makeEntry('a')])
  })

  it('appendEntry preserves insertion order', async () => {
    await appendEntry(file, makeEntry('a'))
    await appendEntry(file, makeEntry('b'))
    await appendEntry(file, makeEntry('c'))
    const q = await readQueue(file)
    expect(q.map((e) => e.key)).toEqual(['a', 'b', 'c'])
  })

  it('removeEntry removes by key', async () => {
    await appendEntry(file, makeEntry('a'))
    await appendEntry(file, makeEntry('b'))
    await removeEntry(file, 'a')
    const q = await readQueue(file)
    expect(q.map((e) => e.key)).toEqual(['b'])
  })

  it('removeEntry is a no-op when key is absent', async () => {
    await appendEntry(file, makeEntry('a'))
    await removeEntry(file, 'never-existed')
    expect(await readQueue(file)).toHaveLength(1)
  })

  it('readQueue on corrupted file returns [] without throwing', async () => {
    await fs.writeFile(file, '{this is not json', 'utf-8')
    expect(await readQueue(file)).toEqual([])
  })

  it('readQueue skips a broken line and keeps the others', async () => {
    await appendEntry(file, makeEntry('a'))
    await fs.appendFile(file, '{"key":"b","ty', 'utf-8')
    await fs.appendFile(file, '\n' + JSON.stringify(makeEntry('c')) + '\n')

    expect((await readQueue(file)).map((e) => e.key)).toEqual(['a', 'c'])
  })

  it('appendEntry after a torn last line keeps the new entry readable', async () => {
    await appendEntry(file, makeEntry('a'))
    await fs.appendFile(file, '{"key":"b","ty', 'utf-8')

    await appendEntry(file, makeEntry('c'))

    expect((await readQueue(file)).map((e) => e.key)).toEqual(['a', 'c'])
  })

  it('appendEntry creates the file when it does not exist', async () => {
    await appendEntry(file, makeEntry('a'))
    expect(await readQueue(file)).toEqual([makeEntry('a')])
  })

  it('writeQueue replaces the whole queue', async () => {
    await appendEntry(file, makeEntry('a'))
    await writeQueue(file, [makeEntry('b'), makeEntry('c')])
    expect((await readQueue(file)).map((e) => e.key)).toEqual(['b', 'c'])
  })

  it('appendEntry after writeQueue keeps one entry per line', async () => {
    await writeQueue(file, [makeEntry('a')])
    await appendEntry(file, makeEntry('b'))
    expect((await readQueue(file)).map((e) => e.key)).toEqual(['a', 'b'])
  })

  it('writeQueue with an empty queue leaves an empty file', async () => {
    await writeQueue(file, [])
    expect(await readQueue(file)).toEqual([])
  })
})
