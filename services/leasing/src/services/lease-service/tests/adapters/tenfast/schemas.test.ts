import { TenfastInvoiceRowSchema } from '../../../adapters/tenfast/schemas'

describe('TenfastInvoiceRowSchema', () => {
  const row = {
    amount: 1000,
    vat: 0,
    from: '2026-01-01',
    to: null,
    article: 'article-id',
    label: 'Hyra',
    _id: 'row-id',
  }

  // An unknown key would be stripped by z.object, and the lease created from
  // the rental object's rows would lose it.
  it('keeps consolidationLabel', () => {
    expect(
      TenfastInvoiceRowSchema.parse({
        ...row,
        consolidationLabel: 'Hyra bostad',
      }).consolidationLabel
    ).toBe('Hyra bostad')
  })

  it('accepts a missing or null consolidationLabel', () => {
    expect(
      TenfastInvoiceRowSchema.parse(row).consolidationLabel
    ).toBeUndefined()
    expect(
      TenfastInvoiceRowSchema.parse({ ...row, consolidationLabel: null })
        .consolidationLabel
    ).toBeNull()
  })
})
