import {
  ComparisonRow,
  aggregateRows,
  applyFilters,
  findDiffKeys,
  groupKey,
  invoiceContributions,
  monthBounds,
  parseContractHeader,
  round2,
  toCsv,
  toDiffRows,
} from '@src/services/invoice-compare/service'

const row = (overrides: Partial<ComparisonRow>): ComparisonRow => ({
  side: 'xpand',
  invoiceNumber: '100001',
  state: 'faktura',
  customer: 'C1',
  contract: '306-008-01-0201/02',
  rentalObject: '306-008-01-0201',
  property: '26001',
  article: 'HYRAB2',
  account: '3011',
  text: 'Artikelrad',
  netto: 1000,
  vat: 250,
  ...overrides,
})

describe('invoice-compare service', () => {
  describe('round2', () => {
    it('avoids floating point noise', () => {
      expect(round2(0.1 + 0.2)).toBe(0.3)
    })
  })

  describe('monthBounds', () => {
    it('returns the last day of the month', () => {
      expect(monthBounds('2026-09')).toEqual({
        from: new Date(Date.UTC(2026, 8, 1)),
        lastDay: '2026-09-30',
        fromString: '2026-09-01',
      })
    })

    it('handles leap years and year boundaries', () => {
      expect(monthBounds('2024-02').lastDay).toBe('2024-02-29')
      expect(monthBounds('2026-12').lastDay).toBe('2026-12-31')
    })
  })

  describe('parseContractHeader', () => {
    it('takes the first comma separated token', () => {
      expect(parseContractHeader('306-008-01-0201/02, Namn Namnsson')).toBe(
        '306-008-01-0201/02'
      )
    })

    it('takes the first space separated token', () => {
      expect(parseContractHeader('306-008-01-0201/02 Namn Namnsson')).toBe(
        '306-008-01-0201/02'
      )
    })
  })

  describe('aggregateRows', () => {
    it('sums netto, vat and row count per key', () => {
      const aggregates = aggregateRows(
        [
          row({ invoiceNumber: '100001', netto: 1000, vat: 250 }),
          row({ invoiceNumber: '100002', netto: 500.5, vat: 125.125 }),
          row({
            side: 'tenfast',
            invoiceNumber: '552606000000001',
            netto: -200,
            vat: -50,
          }),
        ],
        groupKey
      )

      expect(aggregates['306-008-01-0201/02|HYRAB2']).toEqual({
        netto: 1300.5,
        vat: 325.13,
        count: 3,
      })
    })
  })

  describe('findDiffKeys and toDiffRows', () => {
    const left = aggregateRows([row({ netto: 1000, vat: 250 })], groupKey)
    const right = aggregateRows(
      [
        row({ side: 'tenfast', netto: 950, vat: 237.5 }),
        row({
          side: 'tenfast',
          contract: '110-005-02-0601/04',
          article: 'FAKT AVG',
          netto: 49,
          vat: 0,
        }),
      ],
      groupKey
    )

    it('flags groups with different amounts and groups missing on one side', () => {
      const diffKeys = findDiffKeys(left, right)
      expect(diffKeys).toEqual([
        '110-005-02-0601/04|FAKT AVG',
        '306-008-01-0201/02|HYRAB2',
      ])

      const diffs = toDiffRows(left, right, diffKeys)
      expect(diffs).toEqual([
        {
          group: '110-005-02-0601/04|FAKT AVG',
          status: 'bara i tenfast',
          xpandNetto: '',
          tenfastNetto: 49,
          diffNetto: -49,
          xpandVat: '',
          tenfastVat: 0,
          xpandCount: 0,
          tenfastCount: 1,
        },
        {
          group: '306-008-01-0201/02|HYRAB2',
          status: 'olika belopp',
          xpandNetto: 1000,
          tenfastNetto: 950,
          diffNetto: 50,
          xpandVat: 250,
          tenfastVat: 237.5,
          xpandCount: 1,
          tenfastCount: 1,
        },
      ])
    })

    it('ignores differences within tolerance', () => {
      const near = aggregateRows(
        [row({ netto: 950.004, vat: 237.5 })],
        groupKey
      )
      expect(findDiffKeys(near, right)).toEqual(['110-005-02-0601/04|FAKT AVG'])
    })
  })

  describe('invoiceContributions', () => {
    it('points out which invoice on which side a group difference comes from', () => {
      const rows: ComparisonRow[] = [
        // kontrakt+artikel-grupp med diff: xpand 1000 mot tenfast 950
        row({ invoiceNumber: '100001', netto: 1100, vat: 275 }),
        row({ invoiceNumber: '100002', netto: -100, vat: -25 }),
        row({
          side: 'tenfast',
          invoiceNumber: '552606000000001',
          state: 'krediterad',
          netto: 1050,
          vat: 262.5,
        }),
        row({
          side: 'tenfast',
          invoiceNumber: '552606000000002',
          netto: -100,
          vat: -25,
        }),
        // grupp utan diff, ska inte bidra
        row({ invoiceNumber: '100003', article: 'FAKT AVG', netto: 49, vat: 0 }),
        row({
          side: 'tenfast',
          invoiceNumber: '552606000000001',
          article: 'FAKT AVG',
          netto: 49,
          vat: 0,
        }),
      ]

      const left = aggregateRows(rows.filter((r) => r.side === 'xpand'), groupKey)
      const right = aggregateRows(
        rows.filter((r) => r.side === 'tenfast'),
        groupKey
      )
      const diffKeys = findDiffKeys(left, right)
      expect(diffKeys).toEqual(['306-008-01-0201/02|HYRAB2'])

      const contributions = invoiceContributions(rows, diffKeys, groupKey)

      expect(contributions).toEqual([
        expect.objectContaining({
          group: '306-008-01-0201/02|HYRAB2',
          side: 'xpand',
          invoiceNumber: '100001',
          invoiceNetto: 1100,
          rowCount: 1,
        }),
        expect.objectContaining({
          group: '306-008-01-0201/02|HYRAB2',
          side: 'xpand',
          invoiceNumber: '100002',
          invoiceNetto: -100,
          rowCount: 1,
        }),
        expect.objectContaining({
          group: '306-008-01-0201/02|HYRAB2',
          side: 'tenfast',
          invoiceNumber: '552606000000001',
          state: 'krediterad',
          invoiceNetto: 1050,
          rowCount: 1,
        }),
        expect.objectContaining({
          group: '306-008-01-0201/02|HYRAB2',
          side: 'tenfast',
          invoiceNumber: '552606000000002',
          invoiceNetto: -100,
          rowCount: 1,
        }),
      ])
    })

    it('aggregates several rows of the same invoice into one contribution', () => {
      const rows: ComparisonRow[] = [
        row({ invoiceNumber: '100001', netto: 500, vat: 125 }),
        row({ invoiceNumber: '100001', netto: 600, vat: 150 }),
        row({
          side: 'tenfast',
          invoiceNumber: '552606000000001',
          netto: 1000,
          vat: 250,
        }),
      ]

      const diffKeys = findDiffKeys(
        aggregateRows(rows.filter((r) => r.side === 'xpand'), groupKey),
        aggregateRows(rows.filter((r) => r.side === 'tenfast'), groupKey)
      )

      expect(diffKeys).toEqual(['306-008-01-0201/02|HYRAB2'])
      const contributions = invoiceContributions(rows, diffKeys, groupKey)
      expect(contributions).toHaveLength(2)
      expect(
        contributions.find((c) => c.side === 'xpand')
      ).toEqual(
        expect.objectContaining({
          invoiceNumber: '100001',
          invoiceNetto: 1100,
          invoiceVat: 275,
          rowCount: 2,
        })
      )
    })
  })

  describe('applyFilters', () => {
    it('filters on property and article, case insensitively', () => {
      const rows = [
        row({ property: '26001', article: 'HYRAB2' }),
        row({ property: '26002', article: 'HYRAB2' }),
        row({ property: '26001', article: 'FAKT AVG' }),
        row({ property: '26001', article: 'hyrab2' }),
      ]

      const result = applyFilters(rows, {
        properties: ['26001'],
        articles: ['hyrab2'],
      })

      expect(result.rows).toHaveLength(2)
      expect(result.droppedUnknownProperty).toBe(0)
    })

    it('filters on account, case insensitively', () => {
      const rows = [
        row({ account: '3011' }),
        row({ account: '3012' }),
        row({ account: '' }),
      ]

      const result = applyFilters(rows, { accounts: ['3011'] })

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].account).toBe('3011')
    })

    it('counts rows without property when a property filter is set', () => {
      const rows = [row({ property: '' }), row({ property: '26001' })]

      const result = applyFilters(rows, { properties: ['26001'] })

      expect(result.rows).toHaveLength(1)
      expect(result.droppedUnknownProperty).toBe(1)
    })

    it('keeps rows without property when no property filter is set', () => {
      const rows = [row({ property: '' }), row({ property: '26001' })]

      const result = applyFilters(rows, {})

      expect(result.rows).toHaveLength(2)
      expect(result.droppedUnknownProperty).toBe(0)
    })
  })

  describe('toCsv', () => {
    it('writes header and semicolon separated values with quoting', () => {
      expect(
        toCsv([
          { a: 1, b: 'x;y', c: 'say "hi"' },
          { a: 2, b: '', c: null },
        ])
      ).toBe('a;b;c\n1;"x;y";"say ""hi"""\n2;;')
    })

    it('returns empty string for no rows', () => {
      expect(toCsv([])).toBe('')
    })
  })
})
