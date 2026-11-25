import { MiscellaneousInvoiceRow } from '@onecore/types'

import { getArticleById } from '@/data/articles/miscellaneousInvoiceArticles'

// Xledger article for the administrative fee that the "administrative costs"
// checkbox adds as its own row
const ADMINISTRATIVE_FEE_ARTICLE_ID = '329000'

const VAT_RATE = 0.25

/**
 * The rows as entered in the form, with the administrative fee appended when
 * it is selected. Prices are as entered, including VAT.
 */
function withAdministrativeFee(
  rows: MiscellaneousInvoiceRow[],
  administrativeCosts: boolean
): MiscellaneousInvoiceRow[] {
  if (!administrativeCosts) return rows

  const article = getArticleById(ADMINISTRATIVE_FEE_ARTICLE_ID)
  if (!article) return rows

  return [
    ...rows,
    { article, price: article.standardPrice.toString(), amount: 1 },
  ]
}

/**
 * The rows to send to Xledger. Some articles are sent with VAT excluded, so
 * their entered price is converted to a price without VAT.
 */
export function buildInvoiceRowsForSubmission(
  rows: MiscellaneousInvoiceRow[],
  administrativeCosts: boolean
): MiscellaneousInvoiceRow[] {
  return withAdministrativeFee(
    rows.map((row) =>
      row.article?.vatExcluded
        ? { ...row, price: (parseFloat(row.price) / (1 + VAT_RATE)).toString() }
        : row
    ),
    administrativeCosts
  )
}

/**
 * The total the user entered, including the administrative fee, used on the
 * receipt shown after the invoice basis has been sent.
 */
export function sumEnteredInvoiceRows(
  rows: MiscellaneousInvoiceRow[],
  administrativeCosts: boolean
): number {
  return withAdministrativeFee(rows, administrativeCosts).reduce(
    (sum, row) => sum + parseFloat(row.price) * row.amount,
    0
  )
}
