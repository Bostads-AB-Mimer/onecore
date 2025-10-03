import {
  getInvoices,
  getContacts,
  getRentalProperties,
  getInvoiceRows,
} from './adapters/xpand-db-adapter'
import generateBalanceCorrectionFile from './converters/generateBalanceCorrectionFile'
import generateInkassoSergelFile from './converters/generateInkassoSergelFile'
import { getDateString, joinStrings, rightPad } from './converters/utils'
import {
  Invoice,
  EnrichedXledgerRentCase,
  OtherInvoice,
  RentInvoiceRow,
  XledgerBalanceCorrection,
  XledgerBalanceCorrectionColumnIndexes,
  XledgerRentCase,
  XledgerRentCaseColumnIndexes,
  RentalProperty,
  RentInvoice,
  EnrichedXledgerBalanceCorrection,
} from './types'

const importInvoicesFromCsv = (
  csv: string,
  separator = ','
): XledgerRentCase[] => {
  const lines = csv.trim().split('\n')
  const header = lines[0]
  const numColumns = header.split(separator).length

  return lines.slice(1).map((row) => {
    const columns = row.split(separator)
    if (columns.length !== numColumns) {
      throw new CsvError(`Invalid number of columns in row: ${row}`)
    }

    return {
      contactCode: columns[XledgerRentCaseColumnIndexes.contactCode],
      invoiceNumber: columns[XledgerRentCaseColumnIndexes.invoiceNumber],
      invoiceDate: new Date(columns[XledgerRentCaseColumnIndexes.invoiceDate]),
      expiryDate: new Date(columns[XledgerRentCaseColumnIndexes.expiryDate]),
      totalAmount: parseFloat(
        columns[XledgerRentCaseColumnIndexes.totalAmount]
      ),
      remainingAmount: parseFloat(
        columns[XledgerRentCaseColumnIndexes.remainingAmount]
      ),
      comment: columns[XledgerRentCaseColumnIndexes.comment] || undefined,
    }
  })
}

const importBalanceCorrectionsFromCsv = (
  csv: string,
  separator = ','
): XledgerBalanceCorrection[] => {
  const lines = csv.trim().split('\n')
  const header = lines[0]
  const numColumns = header.split(separator).length

  return lines.slice(1).map((row) => {
    const columns = row.split(separator)
    if (columns.length !== numColumns) {
      throw new CsvError(`Invalid number of columns in row: ${row}`)
    }

    return {
      contactCode: columns[XledgerBalanceCorrectionColumnIndexes.contactCode],
      type: columns[XledgerBalanceCorrectionColumnIndexes.type],
      invoiceNumber:
        columns[XledgerBalanceCorrectionColumnIndexes.invoiceNumber],
      date: new Date(columns[XledgerBalanceCorrectionColumnIndexes.date]),
      paidAmount: parseFloat(
        columns[XledgerBalanceCorrectionColumnIndexes.paidAmount]
      ),
      remainingAmount: parseFloat(
        columns[XledgerBalanceCorrectionColumnIndexes.remainingAmount]
      ),
    }
  })
}

export type EnrichResponse =
  | {
      ok: true
      file: string
    }
  | { ok: false; error: Error }

export const enrichRentInvoices = async (
  csv: string
): Promise<EnrichResponse> => {
  try {
    const rows = importInvoicesFromCsv(csv, ';')

    const [contacts, invoices, allInvoiceRows] = await Promise.all([
      getContacts(rows.map((row) => row.contactCode)),
      getInvoices(rows.map((row) => row.invoiceNumber)),
      getInvoiceRows(rows.map((row) => row.invoiceNumber)),
    ])

    const rentalProperties = await getRentalProperties(
      invoices.map((i) => i.reference.split('/')[0])
    )

    const enrichedInvoices = rows.map((row): EnrichedXledgerRentCase => {
      const contact = contacts.find((c) => c.contactCode === row.contactCode)
      if (!contact) {
        // TODO how to handle this?
        throw new Error(
          `Contact not found for contact code '${row.contactCode}'`
        )
      }
      const invoice = invoices.find(
        (i) => i.invoiceNumber === row.invoiceNumber
      )
      if (!invoice) {
        // TODO how to handle this?
        throw new Error(
          `Invoice not found for invoice number '${row.invoiceNumber}'`
        )
      }

      const invoiceRows = allInvoiceRows.filter(
        (ir) => ir.invoiceNumber === invoice.invoiceNumber
      )
      const rentalProperty = rentalProperties.find(
        (res) => res.rentalId === invoice.reference.split('/')[0]
      )
      if (!rentalProperty) {
        throw new Error(
          `Rental property not found for invoice ${invoice.invoiceNumber} with reference ${invoice.reference}`
        )
      }

      const aggregatedRows = aggregateRows(invoiceRows)

      return {
        ...row,
        contact,
        invoice: createInvoiceFromRentInvoiceWithRentalProperty(
          {
            invoiceNumber: invoice.invoiceNumber,
            reference: invoice.reference,
            fromDate: new Date(invoice.fromDate),
            toDate: new Date(invoice.toDate),
            invoiceDate: new Date(invoice.invoiceDate),
            expiryDate: new Date(invoice.expiryDate),
            lastDebitDate: invoice.lastDebitDate
              ? new Date(invoice.lastDebitDate)
              : undefined,
            careOf: invoice.careOf ?? undefined,
          },
          rentalProperty,
          aggregatedRows,
          row.totalAmount - row.remainingAmount
        ),
      }
    })

    // TODO which date?
    const file = generateInkassoSergelFile(enrichedInvoices, new Date())

    return { ok: true, file }
  } catch (err: unknown) {
    return { ok: false, error: err as Error }
  }
}

export const enrichOtherInvoices = async (
  csv: string
): Promise<EnrichResponse> => {
  try {
    const rows = importInvoicesFromCsv(csv, ';')

    const [contacts] = await Promise.all([
      getContacts(rows.map((row) => row.contactCode)),
    ])

    const enrichedInvoices = rows.map((row): EnrichedXledgerRentCase => {
      const contact = contacts.find((c) => c.contactCode === row.contactCode)
      if (!contact) {
        // TODO how to handle this?
        throw new Error(
          `Contact not found for contact code '${row.contactCode}'`
        )
      }
      const invoice: OtherInvoice = {
        invoiceNumber: row.invoiceNumber,
        invoiceDate: row.invoiceDate,
        expiryDate: row.expiryDate,
        totalAmount: row.totalAmount,
        remainingAmount: row.remainingAmount,
        careOf: contact.careOf,
        comment: row.comment,
      }

      return {
        ...row,
        contact,
        invoice: createInvoiceFromOtherInvoice(invoice),
      }
    })

    // TODO which date?
    const file = generateInkassoSergelFile(enrichedInvoices, new Date())

    return { ok: true, file }
  } catch (err: unknown) {
    return { ok: false, error: err as Error }
  }
}

export const enrichBalanceCorrections = async (
  csv: string
): Promise<EnrichResponse> => {
  try {
    const rows = importBalanceCorrectionsFromCsv(csv, ';')

    const invoices = await getInvoices(rows.map((row) => row.invoiceNumber))
    const rentalProperties = await getRentalProperties(
      invoices.map((i) => i.reference.split('/')[0])
    )

    const enrichedBalanceCorrections = rows.map(
      (row): EnrichedXledgerBalanceCorrection => {
        const invoice = invoices.find(
          (i) => i.invoiceNumber === row.invoiceNumber
        )

        if (invoice) {
          const rentalProperty = rentalProperties.find(
            (res) => res.rentalId === invoice.reference.split('/')[0]
          )

          if (!rentalProperty) {
            throw new Error(
              `Rental property not found for invoice ${invoice.invoiceNumber} with reference ${invoice.reference}`
            )
          }

          return {
            ...row,
            hasInvoice: true,
            reference: invoice.reference,
            lastDebitDate: invoice.lastDebitDate,
            rentalProperty: rentalProperty,
          }
        }

        return {
          ...row,
          hasInvoice: false,
        }
      }
    )

    // TODO which date?
    const file = generateBalanceCorrectionFile(
      enrichedBalanceCorrections,
      new Date()
    )

    return { ok: true, file }
  } catch (err: unknown) {
    return { ok: false, error: err as Error }
  }
}

const aggregateRows = (rows: RentInvoiceRow[]): RentInvoiceRow[] => {
  const groups: Record<string, RentInvoiceRow[]> = {}
  const groupMapping: Record<string, string> = {
    O: 'N',
    E: 'A',
  }

  rows.forEach((row) => {
    let key = row.printGroup || 'null'

    if (groupMapping[key]) {
      key = groupMapping[key]
    }

    if (!groups[key]) {
      groups[key] = []
    }

    groups[key].push(row)
  })

  const getMainRow = (groupRows: RentInvoiceRow[]) => {
    return (
      groupRows.find(
        (row) => row.type === 'Rent' && row.rentType === 'Hyra bostad'
      ) ?? groupRows[0]
    )
  }

  return Object.values(groups).map((groupRows) => ({
    ...getMainRow(groupRows),
    amount: groupRows.reduce(
      (sum, row) => sum + row.amount + row.reduction + row.vat,
      0
    ),
  }))
}

const roundedValue = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100

const createInvoiceFromOtherInvoice = (invoice: OtherInvoice): Invoice => {
  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    expiryDate: invoice.expiryDate,
    amount: invoice.remainingAmount,
    comment: invoice.comment ? `       -        Avser: ${invoice.comment}` : '',
    careOf: invoice.careOf,
    rows: [],
  }
}

const createInvoiceFromRentInvoiceWithRentalProperty = (
  invoice: RentInvoice,
  rentalProperty: RentalProperty,
  rows: RentInvoiceRow[],
  amountPaid: number
): Invoice => {
  const removePaidRows = (
    rows: RentInvoiceRow[],
    paid: number
  ): RentInvoiceRow[] => {
    if (paid === 0 || rows.length === 0) {
      return rows
    }

    const sorted = rows
      .sort((a, b) => {
        if (a.rentType === b.rentType) {
          return 0
        }

        if (a.rentType === 'Hemförsäkring') {
          return 1
        }

        if (b.rentType === 'Hemförsäkring') {
          return -1
        }

        if (a.rentType === 'Hyra bostad') {
          return -1
        }

        if (b.rentType === 'Hyra bostad') {
          return 1
        }

        return 0
      })
      .sort((a, b) => {
        if (a.type === b.type) {
          return 0
        }

        if (a.type === 'Rent') {
          return -1
        }

        if (b.type === 'Rent') {
          return 1
        }

        return 0
      })

    const remainingRows: RentInvoiceRow[] = []

    let i = 0
    while (i < sorted.length) {
      const invoiceRow = sorted[i]

      if (paid === 0) {
        remainingRows.push(invoiceRow)
      } else if (invoiceRow.amount <= paid) {
        paid -= invoiceRow.amount
      } else if (invoiceRow.amount > paid) {
        remainingRows.push({
          ...invoiceRow,
          amount: invoiceRow.amount - paid,
        })

        paid = 0
      }

      i++
    }

    return remainingRows
  }

  const unpaidRows = removePaidRows(rows, amountPaid)

  return {
    invoiceNumber: invoice.invoiceNumber,
    reference: invoice.reference,
    amount: unpaidRows.reduce((sum, row) => sum + row.amount, 0),
    rentalProperty: rentalProperty,
    fromDate: invoice.fromDate,
    toDate: invoice.toDate,
    invoiceDate: invoice.invoiceDate,
    expiryDate: invoice.expiryDate,
    comment: createRentInvoiceComment(invoice, rentalProperty),
    careOf: invoice.careOf,
    lastDebitDate: invoice.lastDebitDate,
    rows: unpaidRows,
  }
}

const createRentInvoiceComment = (
  invoice: RentInvoice,
  rentalProperty: RentalProperty
) => {
  return joinStrings([
    invoice.reference,
    ' ',
    `${getDateString(invoice.fromDate)}-${getDateString(invoice.toDate)}`,
    ' Enhet:',
    rightPad(rentalProperty.postalCode.replaceAll(' ', ''), 6, ' '),
    ' ',
    rightPad(rentalProperty.code, 4, ' '),
    ' ',
    rightPad(rentalProperty.address, 33, ' '),
    rightPad(rentalProperty.type, 30, ' '),
    rightPad(
      `Area: ${rentalProperty.areaSize?.toFixed(1).replace('.', ',') ?? '0,0'}`,
      20,
      ' '
    ),
    rentalProperty.rentalPropertyType === 'Residence'
      ? 'Vid ev avhysning, måste förråd tömmas!'
      : '',
  ])
}

export class CsvError extends Error {
  constructor(message: string) {
    super(message)
  }
}
