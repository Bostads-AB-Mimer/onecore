import { describe, expect, it } from 'vitest'

import {
  findSettledExports,
  leaseExportFailureText,
  leaseExportLabel,
} from './leaseExports'

type TestExport = {
  id: string
  status: 'running' | 'done' | 'failed'
  phase: string | null
  statusFilter: string[]
  leaseCount: number | null
  startedAt: string
  finishedAt: string | null
  fileName: string | null
  sizeBytes: number | null
  expiresAt: string | null
  failureReason: 'lease-service-warming-up' | 'export-failed' | null
}

const makeExport = (overrides: Partial<TestExport> = {}): TestExport => ({
  id: 'export-1',
  status: 'running',
  phase: null,
  statusFilter: ['ended'],
  leaseCount: null,
  startedAt: '2026-01-01T10:00:00.000Z',
  finishedAt: null,
  fileName: null,
  sizeBytes: null,
  expiresAt: null,
  failureReason: null,
  ...overrides,
})

const done = (id: string) =>
  makeExport({
    id,
    status: 'done',
    finishedAt: '2026-01-01T10:05:00.000Z',
    fileName: 'leases.xlsx',
    sizeBytes: 1234,
    leaseCount: 10,
    expiresAt: '2026-01-02T10:05:00.000Z',
  })

const failed = (id: string) =>
  makeExport({
    id,
    status: 'failed',
    finishedAt: '2026-01-01T10:05:00.000Z',
    failureReason: 'export-failed',
  })

describe('findSettledExports', () => {
  it('reports nothing on the first load', () => {
    expect(findSettledExports(undefined, [done('a')])).toEqual({
      finished: [],
      failed: [],
    })
  })

  it('reports a running export that is now done', () => {
    const next = [done('a')]
    const result = findSettledExports([makeExport({ id: 'a' })], next)

    expect(result.finished).toEqual(next)
    expect(result.failed).toEqual([])
  })

  it('reports a running export that is now failed', () => {
    const next = [failed('a')]
    const result = findSettledExports([makeExport({ id: 'a' })], next)

    expect(result.failed).toEqual(next)
    expect(result.finished).toEqual([])
  })

  it('reports nothing when a running export is missing from the next list', () => {
    expect(
      findSettledExports([makeExport({ id: 'a' })], [makeExport({ id: 'b' })])
    ).toEqual({ finished: [], failed: [] })
  })

  it('reports nothing when an export was already done', () => {
    expect(findSettledExports([done('a')], [done('a')])).toEqual({
      finished: [],
      failed: [],
    })
  })
})

describe('leaseExportLabel', () => {
  it('labels a single status with its Swedish name', () => {
    expect(leaseExportLabel(makeExport({ statusFilter: ['ended'] }))).toBe(
      'Hyreskontrakt · Upphört'
    )
  })

  it('joins several statuses with a comma', () => {
    expect(
      leaseExportLabel(makeExport({ statusFilter: ['current', 'ended'] }))
    ).toBe('Hyreskontrakt · Gällande, Upphört')
  })

  it('labels an empty filter as all', () => {
    expect(leaseExportLabel(makeExport({ statusFilter: [] }))).toBe(
      'Hyreskontrakt · Alla'
    )
  })
})

describe('leaseExportFailureText', () => {
  it('explains a warming-up lease service', () => {
    expect(leaseExportFailureText('lease-service-warming-up')).toBe(
      'Systemet startar upp, försök igen om en stund.'
    )
  })

  it('uses a generic text for any other reason', () => {
    expect(leaseExportFailureText('export-failed')).toBe(
      'Exporten kunde inte skapas.'
    )
    expect(leaseExportFailureText(null)).toBe('Exporten kunde inte skapas.')
  })
})
