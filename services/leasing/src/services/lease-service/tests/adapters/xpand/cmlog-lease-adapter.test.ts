import { parseLeaseChanges } from '../../../adapters/xpand/cmlog-lease-adapter'

describe('parseLeaseChanges', () => {
  it('extracts leaseId, contactCode and rentalObjectId from logmemo', () => {
    const rows = [
      {
        logmemo:
          'Hyreskontrakt 520-001-04-0202/04, ORRVÄGEN 8 A, P150996, Bostadskontrakt (Kommande)\nVärdet i fältet \'Undertecknat\' ändrat från \'1\' till \'0\'.',
        logtime: new Date('2026-04-28T10:00:00Z'),
      },
    ]

    const result = parseLeaseChanges(rows)

    expect(result).toEqual([
      {
        leaseId: '520-001-04-0202/04',
        contactCode: 'P150996',
        rentalObjectId: '520-001-04-0202',
      },
    ])
  })

  it('filters out rows that do not contain relevant contract types', () => {
    const rows = [
      {
        logmemo:
          'Hyreskontrakt 520-001-04-0202/04, ORRVÄGEN 8 A, P150996, Parkeringskontrakt (Kommande)',
        logtime: new Date('2026-04-28T10:00:00Z'),
      },
    ]

    const result = parseLeaseChanges(rows)

    expect(result).toEqual([])
  })

  it('deduplicates by leaseId', () => {
    const rows = [
      {
        logmemo:
          'Hyreskontrakt 520-001-04-0202/04, ORRVÄGEN 8 A, P150996, Bostadskontrakt (Kommande)\nFoo',
        logtime: new Date('2026-04-28T10:00:00Z'),
      },
      {
        logmemo:
          'Hyreskontrakt 520-001-04-0202/04, ORRVÄGEN 8 A, P150996, Bostadskontrakt (Kommande)\nBar',
        logtime: new Date('2026-04-28T09:00:00Z'),
      },
    ]

    const result = parseLeaseChanges(rows)

    expect(result).toHaveLength(1)
  })

  it('handles Lokalkontrakt and Garagekontrakt', () => {
    const rows = [
      {
        logmemo:
          'Hyreskontrakt 520-001-05-0101/01, GATAN 1, F123456, Lokalkontrakt (Gällande)',
        logtime: new Date('2026-04-28T10:00:00Z'),
      },
      {
        logmemo:
          'Hyreskontrakt 520-001-06-0301/02, VÄGEN 3, P654321, Garagekontrakt (Kommande)',
        logtime: new Date('2026-04-28T10:00:00Z'),
      },
    ]

    const result = parseLeaseChanges(rows)

    expect(result).toHaveLength(2)
  })
})
