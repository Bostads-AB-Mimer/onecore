import { mapXpandDebitRowsToRent } from '../../../adapters/xpand/rental-object-adapter'

describe('mapXpandDebitRowsToRent', () => {
  const now = new Date('2026-08-21')

  it('converts yearly amounts to monthly and trims padded strings', () => {
    const rent = mapXpandDebitRowsToRent(
      [
        {
          rentalpropertyid: '705-021-01-0101               ',
          articleid: 'HYRAFLU2            ',
          advicetext: 'Hyra bostad                     ',
          debitfdate: new Date('2026-01-01'),
          debittodate: null,
          yearrent: 106499.93,
        },
      ],
      now
    )

    expect(rent.rows).toEqual([
      {
        code: 'HYRAFLU2',
        description: 'Hyra bostad',
        amount: 106499.93 / 12,
        vatPercentage: 0,
        fromDate: new Date('2026-01-01'),
        toDate: undefined,
      },
    ])
    expect(rent.vat).toBe(0)
  })

  it('sums only rows active today into the total', () => {
    const rent = mapXpandDebitRowsToRent(
      [
        {
          rentalpropertyid: 'x',
          articleid: 'A',
          advicetext: 'Active open-ended',
          debitfdate: new Date('2025-01-01'),
          debittodate: null,
          yearrent: 1200,
        },
        {
          rentalpropertyid: 'x',
          articleid: 'B',
          advicetext: 'Not started yet',
          debitfdate: new Date('2027-01-01'),
          debittodate: null,
          yearrent: 2400,
        },
        {
          rentalpropertyid: 'x',
          articleid: 'C',
          advicetext: 'Expired',
          debitfdate: new Date('2024-01-01'),
          debittodate: new Date('2025-12-31'),
          yearrent: 3600,
        },
        {
          rentalpropertyid: 'x',
          articleid: 'D',
          advicetext: 'Active bounded',
          debitfdate: new Date('2026-08-01'),
          debittodate: new Date('2026-08-31'),
          yearrent: 4800,
        },
      ],
      now
    )

    // A (100/month) + D (400/month); B is future and C is expired
    expect(rent.amount).toBe(500)
    expect(rent.rows).toHaveLength(4)
  })

  it('handles null amounts and missing dates', () => {
    const rent = mapXpandDebitRowsToRent(
      [
        {
          rentalpropertyid: 'x',
          articleid: null,
          advicetext: null,
          debitfdate: null,
          debittodate: null,
          yearrent: null,
        },
      ],
      now
    )

    expect(rent.amount).toBe(0)
    expect(rent.rows[0]).toEqual({
      code: '',
      description: '',
      amount: 0,
      vatPercentage: 0,
      fromDate: undefined,
      toDate: undefined,
    })
  })
})
