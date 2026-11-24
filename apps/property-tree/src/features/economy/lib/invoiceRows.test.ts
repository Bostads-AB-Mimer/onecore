import { MiscellaneousInvoiceRow } from '@onecore/types'
import { describe, expect, it } from 'vitest'

import {
  buildInvoiceRowsForSubmission,
  sumEnteredInvoiceRows,
} from './invoiceRows'

const article = { id: '1', name: 'Städning', standardPrice: 0 }
const vatExcludedArticle = { ...article, id: '2', vatExcluded: true }

const rows: MiscellaneousInvoiceRow[] = [
  { article, price: '100', amount: 2 },
  { article: vatExcludedArticle, price: '125', amount: 1 },
]

describe('buildInvoiceRowsForSubmission', () => {
  it('removes VAT from articles that are sent without VAT', () => {
    const result = buildInvoiceRowsForSubmission(rows, false)

    expect(result).toHaveLength(2)
    expect(result[0].price).toBe('100')
    expect(parseFloat(result[1].price)).toBe(100)
  })

  it('appends the administrative fee when selected', () => {
    const result = buildInvoiceRowsForSubmission(rows, true)

    expect(result).toHaveLength(3)
    expect(result[2]).toMatchObject({
      article: { id: '329000' },
      price: '595',
      amount: 1,
    })
  })
})

describe('sumEnteredInvoiceRows', () => {
  it('sums the prices as entered, including VAT', () => {
    expect(sumEnteredInvoiceRows(rows, false)).toBe(325)
  })

  it('includes the administrative fee when selected', () => {
    expect(sumEnteredInvoiceRows(rows, true)).toBe(920)
  })
})
