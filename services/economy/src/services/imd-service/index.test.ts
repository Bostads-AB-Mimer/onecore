import assert from 'node:assert'
import { imdService } from '.'

const csv = `
306-008-01-0201;2026-01-01;2026-01-31;VV;129,312;136,892;7,580;621,680;;82,016;m3;;;1
306-008-01-0202;2026-01-01;2026-01-31;VV;50,608;52,702;2,094;171,740;;82,016;m3;;;1
306-008-01-0203;2026-01-01;2026-01-31;VV;16,893;17,682;0,789;64,710;;82,016;m3;;;1
`

describe(imdService.parseCsv, () => {
  it('parses csv', () => {
    const result = imdService.parseCsv(csv)
    assert(result.ok)

    expect(() =>
      imdService.IMDRowSchema.array().parse(result.data)
    ).not.toThrow()
  })
})

describe(imdService.enrichIMDRows, () => {
  it('enriches imd rows', async () => {
    const foo = {
      first: {
        leaseId: 'lease-1',
        rentalObjectCode: 'rental-object-1',
      },
      second: {
        leaseId: 'lease-2',
        rentalObjectCode: 'rental-object-2',
      },
    }

    const result = await imdService.enrichIMDRows([
      {
        rentalObjectCode: foo.first.rentalObjectCode,
        from: new Date(),
        to: new Date(),
        unit: 'm3',
        volume: 1,
        cost: 100,
      },
      {
        rentalObjectCode: foo.second.rentalObjectCode,
        from: new Date(),
        to: new Date(),
        unit: 'm3',
        volume: 1,
        cost: 100,
      },
    ])

    assert(result.ok)

    expect(() =>
      imdService.IMDRowSchema.array().parse(result.data)
    ).not.toThrow()
    console.log(result)
  })
})
