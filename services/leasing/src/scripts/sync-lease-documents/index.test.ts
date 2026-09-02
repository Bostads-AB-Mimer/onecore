import {
  OVERSIZED_HEADER,
  completedKeyFromRow,
  oversizedRow,
  parseArgs,
} from './index'

describe('parseArgs', () => {
  it('ignores the bare -- that pnpm forwards', () => {
    expect(parseArgs(['--', '--limit-leases', '3']).limitLeases).toBe(3)
  })

  it('parses a comma-separated list of specific leases', () => {
    const options = parseArgs([
      '--leases',
      '307-714-00-0102/08,104-071-06-0403/12',
    ])
    expect(options.leases).toEqual(['307-714-00-0102/08', '104-071-06-0403/12'])
  })

  it('trims whitespace around lease ids', () => {
    expect(parseArgs(['--leases', ' a/01 , b/02 ']).leases).toEqual([
      'a/01',
      'b/02',
    ])
  })

  it('defaults to no lease filter', () => {
    expect(parseArgs([]).leases).toEqual([])
  })

  it('parses stages, dry-run and concurrency', () => {
    const options = parseArgs([
      '--stages',
      'active,voided',
      '--dry-run',
      '--concurrency',
      '2',
    ])
    expect(options.stages).toEqual(['active', 'voided'])
    expect(options.dryRun).toBe(true)
    expect(options.concurrency).toBe(2)
  })

  it('parses --max-failures and defaults it', () => {
    expect(parseArgs(['--max-failures', '5']).maxFailures).toBe(5)
    expect(parseArgs([]).maxFailures).toBe(25)
    expect(parseArgs(['--max-failures', '0']).maxFailures).toBe(0)
  })

  it('rejects unknown arguments and bad numbers', () => {
    expect(() => parseArgs(['--nope'])).toThrow('Unknown argument')
    expect(() => parseArgs(['--concurrency', '0'])).toThrow('--concurrency')
  })
})

describe('oversized report', () => {
  const action = {
    leaseId: '209-001-02-0203/10',
    tenfastId: '6a8db7b79bdba910355c6765',
    target: 'related-docs' as const,
    keydorev: '_69U0KUD9PNWBPX',
    dok: '20240115-09482447',
    filename: 'Överlåtelseansökan för komplettering, P082667.pdf',
    title: 'Överlåtelseansökan för komplettering',
    documentType: 'Handling',
    createdAt: '2024-01-15',
    bytes: 25773057,
  }

  it('writes one line per document with everything needed to find it in xpand', () => {
    const line = oversizedRow(action)
    expect(line).toContain('209-001-02-0203/10')
    expect(line).toContain('_69U0KUD9PNWBPX')
    expect(line).toContain('25773057')
    expect(line).toContain('24.6')
  })

  it('quotes the filename, which contains a comma', () => {
    expect(oversizedRow(action)).toContain(
      '"Överlåtelseansökan för komplettering, P082667.pdf"'
    )
  })

  it('has a header column for every field it writes', () => {
    expect(OVERSIZED_HEADER.split(',')).toHaveLength(
      oversizedRow({ ...action, filename: 'x.pdf', title: 'x' }).split(',')
        .length
    )
  })
})

describe('resume log parsing', () => {
  // Filenames contain commas — "Överlåtelseansökan för komplettering, P082667.pdf"
  // — so the row is quoted and a naive split on ',' shifts every later field,
  // making a completed upload look unfinished and sending it again.
  it('reads back a row whose filename contains a comma', () => {
    const row = [
      '209-001-02-0203/10',
      '6a8db7b79bdba910355c6765',
      'related-docs',
      '_69U0KUD9PNWBPX',
      '"Överlåtelseansökan för komplettering, P082667.pdf"',
      '25773057',
      'uploaded',
      '',
    ].join(',')

    expect(completedKeyFromRow(row)).toBe(
      '209-001-02-0203/10|related-docs|_69U0KUD9PNWBPX'
    )
  })

  it('reads back a plain row', () => {
    const row =
      '104-071-06-0403/12,6a8db,upload-file,_7J10SF8VGCNCBV,Kontrakt.pdf,845692,uploaded,'
    expect(completedKeyFromRow(row)).toBe(
      '104-071-06-0403/12|upload-file|_7J10SF8VGCNCBV'
    )
  })

  it('ignores rows that did not succeed', () => {
    const failed =
      '209-001-02-0203/10,6a8db,related-docs,_69U0,"big, file.pdf",25773057,too-large,over the limit'
    expect(completedKeyFromRow(failed)).toBeNull()
    expect(completedKeyFromRow('')).toBeNull()
    expect(
      completedKeyFromRow(
        'leaseId,tenfastId,target,keydorev,filename,bytes,status,error'
      )
    ).toBeNull()
  })

  it('unescapes a doubled quote inside a filename', () => {
    const row = 'x/01,id,related-docs,_K1,"a""b.pdf",10,uploaded,'
    expect(completedKeyFromRow(row)).toBe('x/01|related-docs|_K1')
  })
})
