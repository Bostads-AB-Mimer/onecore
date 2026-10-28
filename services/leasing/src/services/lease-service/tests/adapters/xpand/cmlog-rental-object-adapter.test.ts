import knex, { Knex } from 'knex'
import { logger } from '@onecore/utilities'

import {
  cmlogRentalObjectTypeChanges,
  parseRentalObjectTypeChanges,
} from '../../../adapters/xpand/cmlog-rental-object-adapter'

afterEach(() => {
  jest.restoreAllMocks()
})

describe('cmlogRentalObjectTypeChanges', () => {
  it('reads strictly after the since time', () => {
    const db = knex({ client: 'mssql' })

    const { sql } = (
      cmlogRentalObjectTypeChanges(
        db,
        new Date('2026-10-15T08:08:28.000Z')
      ) as unknown as Knex.QueryBuilder
    ).toSQL()

    expect(sql).toMatch(/\[logtime\] > \?/)
  })

  it('reads every row when since is null', () => {
    const db = knex({ client: 'mssql' })

    const { sql } = (
      cmlogRentalObjectTypeChanges(db, null) as unknown as Knex.QueryBuilder
    ).toSQL()

    expect(sql).not.toMatch(/logtime\] >/)
  })
})

const memo = (firstLine: string, ...lines: string[]) =>
  [firstLine, ...lines].join('\r\n')

const typeLine = (from: string, to: string) =>
  `Värdet i fältet 'Hyresobjekttyp' ändrat från '${from}' till '${to}'.`

const at = (iso: string) => new Date(iso)

describe('parseRentalObjectTypeChanges', () => {
  it('extracts rental object code, code and label from a CRLF memo', () => {
    const rows = [
      {
        logmemo: memo(
          'Hyresobjekt 807-033-01-0101',
          typeLine('STD Standard hyresobjektstyp', 'POÄNGFRITT Poängfritt')
        ),
        logtime: at('2026-10-15T08:08:28.000Z'),
      },
    ]

    expect(parseRentalObjectTypeChanges(rows)).toEqual([
      {
        rentalObjectCode: '807-033-01-0101',
        code: 'POÄNGFRITT',
        label: 'Poängfritt',
        timestamp: at('2026-10-15T08:08:28.000Z'),
      },
    ])
  })

  it('finds the type line after another changed field', () => {
    const rows = [
      {
        logmemo: memo(
          'Hyresobjekt 307-096-01-0101',
          "Värdet i fältet 'Egenskaper' ändrat från '' till 'Balkong'.",
          typeLine('NYPROD Nyproduktion', 'STD Standard hyresobjektstyp')
        ),
        logtime: at('2026-10-01T10:00:00.000Z'),
      },
    ]

    expect(parseRentalObjectTypeChanges(rows)).toEqual([
      expect.objectContaining({
        rentalObjectCode: '307-096-01-0101',
        code: 'STD',
        label: 'Standard hyresobjektstyp',
      }),
    ])
  })

  it('returns null code and label when the type is cleared', () => {
    const rows = [
      {
        logmemo: memo(
          'Hyresobjekt 705-025-01-0301',
          typeLine('STD Standard hyresobjektstyp', '')
        ),
        logtime: at('2026-10-01T10:00:00.000Z'),
      },
    ]

    expect(parseRentalObjectTypeChanges(rows)).toEqual([
      expect.objectContaining({
        rentalObjectCode: '705-025-01-0301',
        code: null,
        label: null,
      }),
    ])
  })

  it('returns the code with a null label when the target has no label', () => {
    const rows = [
      {
        logmemo: memo(
          'Hyresobjekt 705-025-01-0301',
          typeLine('STD Standard hyresobjektstyp', 'HDK')
        ),
        logtime: at('2026-10-01T10:00:00.000Z'),
      },
    ]

    expect(parseRentalObjectTypeChanges(rows)).toEqual([
      expect.objectContaining({ code: 'HDK', label: null }),
    ])
  })

  it('ignores trailing whitespace on the type line', () => {
    const rows = [
      {
        logmemo: memo(
          'Hyresobjekt 705-025-01-0301  ',
          typeLine('STD Standard hyresobjektstyp', 'KORTTID Korttidskontrakt') +
            '   '
        ),
        logtime: at('2026-10-01T10:00:00.000Z'),
      },
    ]

    expect(parseRentalObjectTypeChanges(rows)).toEqual([
      expect.objectContaining({
        rentalObjectCode: '705-025-01-0301',
        code: 'KORTTID',
        label: 'Korttidskontrakt',
      }),
    ])
  })

  it('skips rows without a type line', () => {
    const rows = [
      {
        logmemo: memo(
          'Hyresobjekt 705-025-01-0301',
          "Värdet i fältet 'Egenskaper' ändrat från '' till 'Balkong'."
        ),
        logtime: at('2026-10-01T10:00:00.000Z'),
      },
    ]

    expect(parseRentalObjectTypeChanges(rows)).toEqual([])
  })

  it('logs only the first memo line of a skipped row', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger)
    const rows = [
      {
        logmemo: memo(
          'Hyresobjekt 705-025-01-0301',
          "Värdet i fältet 'Notering' ändrat från '' till 'Ring P123456 först'."
        ),
        logtime: at('2026-10-01T10:00:00.000Z'),
      },
    ]

    parseRentalObjectTypeChanges(rows)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(warn.mock.calls[0])).toContain(
      'Hyresobjekt 705-025-01-0301'
    )
    expect(JSON.stringify(warn.mock.calls[0])).not.toContain('P123456')
  })

  it('skips rows without a rental object code on the first line', () => {
    const rows = [
      {
        logmemo: typeLine(
          'STD Standard hyresobjektstyp',
          'POÄNGFRITT Poängfritt'
        ),
        logtime: at('2026-10-01T10:00:00.000Z'),
      },
    ]

    expect(parseRentalObjectTypeChanges(rows)).toEqual([])
  })

  it('keeps only the latest change per rental object, ordered by that change', () => {
    const rows = [
      {
        logmemo: memo(
          'Hyresobjekt A-1',
          typeLine('POÄNGFRITT Poängfritt', 'STD Standard hyresobjektstyp')
        ),
        logtime: at('2026-10-15T08:00:00.000Z'),
      },
      {
        logmemo: memo(
          'Hyresobjekt B-2',
          typeLine('STD Standard hyresobjektstyp', 'KORTTID Korttidskontrakt')
        ),
        logtime: at('2026-10-15T08:01:00.000Z'),
      },
      {
        logmemo: memo(
          'Hyresobjekt A-1',
          typeLine('STD Standard hyresobjektstyp', 'POÄNGFRITT Poängfritt')
        ),
        logtime: at('2026-10-15T08:02:00.000Z'),
      },
    ]

    expect(parseRentalObjectTypeChanges(rows)).toEqual([
      {
        rentalObjectCode: 'B-2',
        code: 'KORTTID',
        label: 'Korttidskontrakt',
        timestamp: at('2026-10-15T08:01:00.000Z'),
      },
      {
        rentalObjectCode: 'A-1',
        code: 'POÄNGFRITT',
        label: 'Poängfritt',
        timestamp: at('2026-10-15T08:02:00.000Z'),
      },
    ])
  })

  it('passes unusual rental object codes through unchanged', () => {
    const rows = ['15804', '110-011-99-0048XZQ'].map((code, i) => ({
      logmemo: memo(
        `Hyresobjekt ${code}`,
        typeLine('STD Standard hyresobjektstyp', 'POÄNGFRITT Poängfritt')
      ),
      logtime: at(`2026-10-15T08:0${i}:00.000Z`),
    }))

    expect(
      parseRentalObjectTypeChanges(rows).map((c) => c.rentalObjectCode)
    ).toEqual(['15804', '110-011-99-0048XZQ'])
  })
})
