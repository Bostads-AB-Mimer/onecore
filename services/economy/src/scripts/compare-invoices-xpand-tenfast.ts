import {
  closeDb,
  compareInvoices,
} from '@src/services/invoice-compare/service'

/**
 * Jämför fakturerade rader mellan Xpand och Tenfast för en månad, filtrerat
 * på fastighet (fastighetskod), hyresartikel och/eller konto, för att kunna
 * peka ut vilken faktura en skillnad kommer ifrån.
 *
 *   pnpm dev:script:compare-invoices-xpand-tenfast -- --month 2026-09 --property 26001 [--article HYRAB2] [--account 3011] [--company 001] [--out ./generated/invoice-compare]
 *
 * Utdata (CSV i --out-katalogen):
 *   xpand_rows.csv, tenfast_rows.csv            normaliserade fakurarader
 *   diff_per_kontrakt_artikel.csv               grupper som skiljer sig
 *   invoice_contributions.csv                   per diffande grupp: vilka
 *                                               fakturor som bidrar på vardera
 *                                               sidan (här syns vilken faktura
 *                                               en skillnad kommer ifrån)
 */
const parseArgs = () => {
  const args = process.argv.slice(2)
  const get = (flag: string): string | undefined => {
    const index = args.indexOf(flag)
    return index >= 0 ? args[index + 1] : undefined
  }

  const month = get('--month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(
      'Usage: compare-invoices-xpand-tenfast --month YYYY-MM [--property <kod,kod...>] [--article <kod,kod...>] [--account <konto,konto...>] [--company 001] [--out DIR]'
    )
  }

  const split = (value?: string): string[] | undefined =>
    value
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item !== '')
      : undefined

  return {
    month,
    properties: split(get('--property')),
    articles: split(get('--article')),
    accounts: split(get('--account')),
    company: get('--company'),
    outputDir: get('--out'),
  }
}

const run = async () => {
  const options = parseArgs()

  try {
    await compareInvoices(options)
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  } finally {
    await closeDb()
  }
}

run()
