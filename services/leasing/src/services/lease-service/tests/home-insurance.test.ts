import * as factory from './factories'
import {
  checkHomeInsuranceWrite,
  hasOpenOrUpcomingHomeInsuranceRow,
  planHomeInsuranceCancel,
  planHomeInsuranceEnd,
  selectCurrentHomeInsuranceRow,
  withEndDate,
} from '../services/home-insurance'
import {
  TenfastInvoiceRow,
  YearMonthDayStringSchema,
} from '../adapters/tenfast/schemas'

const ARTICLE_ID = 'home-insurance-article-id'
const TODAY = '2026-11-13'

const day = (value: string) => YearMonthDayStringSchema.parse(value)

const insuranceRow = (
  overrides: Partial<TenfastInvoiceRow> = {}
): TenfastInvoiceRow =>
  factory.tenfastInvoiceRow.build({
    article: ARTICLE_ID,
    label: 'Hemförsäkring',
    amount: 93,
    vat: 0,
    from: day('2026-01-01'),
    to: null,
    ...overrides,
  })

describe(selectCurrentHomeInsuranceRow, () => {
  it('picks the row in force over an ended row listed before it', () => {
    const ended = insuranceRow({
      from: day('2025-01-01'),
      to: day('2025-12-31'),
    })
    const current = insuranceRow({ from: day('2026-01-01'), to: null })

    expect(
      selectCurrentHomeInsuranceRow([ended, current], ARTICLE_ID, TODAY)
    ).toBe(current)
  })

  it('counts both the first and the last day as in force', () => {
    const endsToday = insuranceRow({
      from: day('2026-01-01'),
      to: day(TODAY),
    })
    // Ends too, so it does not take over after the row in force.
    const upcoming = insuranceRow({
      from: day('2026-12-01'),
      to: day('2026-12-31'),
    })

    expect(
      selectCurrentHomeInsuranceRow([upcoming, endsToday], ARTICLE_ID, TODAY)
    ).toBe(endsToday)

    const startsToday = insuranceRow({ from: day(TODAY) })
    expect(
      selectCurrentHomeInsuranceRow([startsToday], ARTICLE_ID, TODAY)
    ).toBe(startsToday)
  })

  it('picks the next row to start when none is in force', () => {
    const ended = insuranceRow({
      from: day('2025-01-01'),
      to: day('2025-12-31'),
    })
    const later = insuranceRow({ from: day('2027-02-01') })
    const next = insuranceRow({ from: day('2026-12-01') })

    expect(
      selectCurrentHomeInsuranceRow([ended, later, next], ARTICLE_ID, TODAY)
    ).toBe(next)
  })

  it('picks the last ended row when none is in force or to come', () => {
    const first = insuranceRow({
      from: day('2024-01-01'),
      to: day('2024-12-31'),
    })
    const last = insuranceRow({
      from: day('2025-01-01'),
      to: day('2025-12-31'),
    })

    expect(
      selectCurrentHomeInsuranceRow([last, first], ARTICLE_ID, TODAY)
    ).toBe(last)
  })

  it('treats a row ending before it starts as ended, not as to come', () => {
    const voidRow = insuranceRow({
      from: day('2026-12-01'),
      to: day('2026-11-30'),
    })
    const ended = insuranceRow({
      from: day('2025-01-01'),
      to: day('2025-12-31'),
    })

    expect(
      selectCurrentHomeInsuranceRow([ended, voidRow], ARTICLE_ID, TODAY)
    ).toBe(voidRow)

    const upcoming = insuranceRow({ from: day('2026-12-01') })
    expect(
      selectCurrentHomeInsuranceRow([voidRow, upcoming], ARTICLE_ID, TODAY)
    ).toBe(upcoming)
  })

  it('picks the open-ended row that takes over after the row in force ends', () => {
    // Such as a price change: the old row ends, the new one goes on.
    const ending = insuranceRow({
      from: day('2026-01-01'),
      to: day('2026-12-31'),
    })
    const successor = insuranceRow({ from: day('2027-01-01'), to: null })

    expect(
      selectCurrentHomeInsuranceRow([ending, successor], ARTICLE_ID, TODAY)
    ).toBe(successor)
  })
})

describe('refund rows (negative amount, left from Xpand)', () => {
  const refund = insuranceRow({
    _id: 'refund',
    amount: -93,
    from: day('2026-11-01'),
    to: null,
  })
  const insurance = insuranceRow({
    _id: 'insurance',
    from: day('2026-01-01'),
    to: null,
  })

  it('never picks a refund row as the current row', () => {
    expect(
      selectCurrentHomeInsuranceRow([insurance, refund], ARTICLE_ID, TODAY)?._id
    ).toBe('insurance')
    expect(
      selectCurrentHomeInsuranceRow([refund], ARTICLE_ID, TODAY)
    ).toBeUndefined()
  })

  it('does not count a refund row as insurance when adding', () => {
    expect(hasOpenOrUpcomingHomeInsuranceRow([refund], ARTICLE_ID, TODAY)).toBe(
      false
    )
  })

  it('leaves a refund row alone on cancel, even one starting after endDate', () => {
    const laterRefund = { ...refund, from: day('2027-02-01') }

    const plan = planHomeInsuranceCancel(
      [insurance, laterRefund],
      ARTICLE_ID,
      day('2026-12-31'),
      TODAY
    )

    expect(plan?.rowsToDelete).toEqual(['insurance'])
    expect(plan?.written.to).toBe('2026-12-31')
  })
})

describe(hasOpenOrUpcomingHomeInsuranceRow, () => {
  it('is true for a row still to start, even with an end date', () => {
    expect(
      hasOpenOrUpcomingHomeInsuranceRow(
        [insuranceRow({ from: day('2027-01-01'), to: day('2027-06-30') })],
        ARTICLE_ID,
        TODAY
      )
    ).toBe(true)
  })

  it('is false for rows that end, void rows and other articles', () => {
    expect(
      hasOpenOrUpcomingHomeInsuranceRow(
        [
          insuranceRow({ from: day('2026-01-01'), to: day('2026-12-31') }),
          insuranceRow({ from: day('2027-02-01'), to: day('2027-01-31') }),
          factory.tenfastInvoiceRow.build({ article: 'rent', to: null }),
        ],
        ARTICLE_ID,
        TODAY
      )
    ).toBe(false)
  })
})

describe(planHomeInsuranceCancel, () => {
  const ending = insuranceRow({
    _id: 'ending',
    from: day('2026-01-01'),
    to: day('2026-12-31'),
  })
  const successor = insuranceRow({
    _id: 'successor',
    from: day('2027-01-01'),
    to: null,
  })

  it('removes a row that would start after endDate', () => {
    expect(
      planHomeInsuranceCancel(
        [ending, successor],
        ARTICLE_ID,
        day('2026-11-30'),
        TODAY
      )
    ).toEqual({
      rowsToDelete: ['ending', 'successor'],
      written: withEndDate(ending, day('2026-11-30')),
    })
  })

  it('ends the row in force on endDate and leaves rows that ended before it', () => {
    expect(
      planHomeInsuranceCancel(
        [ending, successor],
        ARTICLE_ID,
        day('2027-03-31'),
        TODAY
      )
    ).toEqual({
      rowsToDelete: ['successor'],
      written: withEndDate(successor, day('2027-03-31')),
    })
  })

  it('keeps the first row to come, ended on its first day, when endDate is before every row', () => {
    const first = insuranceRow({ _id: 'first', from: day('2026-12-01') })
    const second = insuranceRow({
      _id: 'second',
      from: day('2027-01-01'),
      to: null,
    })

    expect(
      planHomeInsuranceCancel(
        [second, first],
        ARTICLE_ID,
        day('2026-11-15'),
        TODAY
      )
    ).toEqual({
      rowsToDelete: ['first', 'second'],
      written: withEndDate(first, day('2026-12-01')),
    })
  })
})

describe(planHomeInsuranceEnd, () => {
  const row = insuranceRow({ from: day('2026-12-01'), to: null })

  it('removes the row when cancelled on its first day', () => {
    expect(planHomeInsuranceEnd(row, day('2026-12-01'), 'cancel')).toEqual({
      kind: 'delete',
    })
  })

  it('refuses set-end before the first day', () => {
    expect(planHomeInsuranceEnd(row, day('2026-11-30'), 'set-end')).toEqual({
      kind: 'error',
      error: 'end-date-before-start',
    })
  })

  it('ends the row on its first day with set-end, rather than removing it', () => {
    expect(planHomeInsuranceEnd(row, day('2026-12-01'), 'set-end')).toEqual({
      kind: 'replace',
      row: expect.objectContaining({ from: '2026-12-01', to: '2026-12-01' }),
    })
  })

  it('refuses to end the row on the day it already ends', () => {
    const ending = insuranceRow({
      from: day('2026-01-01'),
      to: day('2026-12-31'),
    })

    for (const action of ['cancel', 'set-end'] as const) {
      expect(planHomeInsuranceEnd(ending, day('2026-12-31'), action)).toEqual({
        kind: 'error',
        error: 'end-date-unchanged',
      })
    }
  })

  it('copies includeInContract to the new row, since Tenfast sets a missing one to false', () => {
    const flagged = insuranceRow({ includeInContract: true })

    const plan = planHomeInsuranceEnd(flagged, day('2027-01-31'), 'set-end')

    expect(plan.kind === 'replace' && plan.row.includeInContract).toBe(true)
  })
})

describe(checkHomeInsuranceWrite, () => {
  const old = insuranceRow({ _id: 'old', from: day('2026-01-01') })
  const written = withEndDate(old, day('2026-12-31'))

  it('accepts a replace that left exactly the written row, and returns it', () => {
    const rent = factory.tenfastInvoiceRow.build({ article: 'rent', _id: 'r' })
    const added = { ...written, _id: 'new' }

    const result = checkHomeInsuranceWrite({
      rowsBefore: [rent, old],
      rowsAfter: [rent, added],
      articleId: ARTICLE_ID,
      removedRowIds: ['old'],
      written,
    })

    expect(result).toEqual({ ok: true, row: added })
  })

  it('accepts the written row when Tenfast gave every row a new id', () => {
    const ended = insuranceRow({
      _id: 'ended',
      from: day('2025-01-01'),
      to: day('2025-12-31'),
    })
    const added = { ...written, _id: 'new' }

    const result = checkHomeInsuranceWrite({
      rowsBefore: [ended, old],
      rowsAfter: [{ ...ended, _id: 'ended-2' }, added],
      articleId: ARTICLE_ID,
      removedRowIds: ['old'],
      written,
    })

    expect(result).toEqual({ ok: true, row: added })
  })

  it('fails when the old row is still there', () => {
    const result = checkHomeInsuranceWrite({
      rowsBefore: [old],
      rowsAfter: [old, { ...written, _id: 'new' }],
      articleId: ARTICLE_ID,
      removedRowIds: ['old'],
      written,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'old-row-still-present',
      addedRowIds: ['new'],
    })
  })

  it('fails when someone else replaced the row at the same time', () => {
    // Another write already replaced the old row; Tenfast then took this
    // write's stale id without complaint and added a second row.
    const theirs = { ...withEndDate(old, day('2026-11-30')), _id: 'theirs' }
    const ours = { ...written, _id: 'ours' }

    const result = checkHomeInsuranceWrite({
      rowsBefore: [old],
      rowsAfter: [theirs, ours],
      articleId: ARTICLE_ID,
      removedRowIds: ['old'],
      written,
    })

    // Both rows are named, so the duplicate can be found and removed.
    expect(result).toEqual({
      ok: false,
      reason: 'rows-differ',
      addedRowIds: ['theirs', 'ours'],
    })
  })
})
