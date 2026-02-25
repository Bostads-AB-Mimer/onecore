import { logger } from '@onecore/utilities'
import {
  getInvoices,
  getContacts as getXpandContacts,
  getRentalProperties,
  getInvoiceRows,
} from '../common/adapters/xpand-db-adapter'
import {
  getContacts as getXledgerContacts,
  XledgerContact,
} from '../common/adapters/xledger-adapter'
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
} from '../common/types'
import { InvoiceDeliveryMethod, XpandContact } from '@src/common/types'

export const importInvoicesFromCsv = (
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

export const importBalanceCorrectionsFromCsv = (
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

const transformXledgerContactToXpandContact = (
  xledgerContact: XledgerContact
): XpandContact => {
  return {
    contactCode: xledgerContact.contactCode,
    address: {
      street: xledgerContact.address.street,
      city: xledgerContact.address.city,
      postalCode: xledgerContact.address.postalCode,
      number: '',
    },
    fullName: xledgerContact.fullName,
    nationalRegistrationNumber: xledgerContact.nationalRegistrationNumber,
    phoneNumbers: [
      {
        phoneNumber: xledgerContact.phoneNumber ?? '',
        type: '',
        isMainNumber: true,
      },
    ],
    // TODO These properties are only here to satisfy the Contact type, should refactor to use some other type
    contactKey: '',
    birthDate: new Date(),
    firstName: '',
    lastName: '',
    isTenant: false,
    autogiro: false,
    invoiceDeliveryMethod: InvoiceDeliveryMethod.Other,
  }
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
      getXpandContacts(rows.map((row) => row.contactCode)),
      getInvoices(rows.map((row) => row.invoiceNumber)),
      getInvoiceRows(rows.map((row) => row.invoiceNumber)),
    ])

    const allLeaseIds = extractLeaseIdsFromInvoiceRows(allInvoiceRows)
    const rentalProperties = await getRentalProperties(
      allLeaseIds.map(getRentalIdFromLeaseId)
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
      const leaseIdsForInvoice = extractLeaseIdsFromInvoiceRows(invoiceRows)
      const rentalPropertiesForInvoice = rentalProperties.filter(
        (rentalProperty) =>
          leaseIdsForInvoice
            .map(getRentalIdFromLeaseId)
            .includes(rentalProperty.rentalId)
      )

      if (rentalPropertiesForInvoice.length === 0) {
        throw new Error(
          `Rental properties not found for invoice ${invoice.invoiceNumber}`
        )
      }

      const reference = getReferenceForInvoice(
        leaseIdsForInvoice,
        rentalPropertiesForInvoice
      )

      const aggregatedRows = aggregateRows(invoiceRows)
      const aggregatedRowsWithRoundoff = addRoundoffToFirstRow(
        aggregatedRows,
        invoice.roundoff
      )

      return {
        ...row,
        contact,
        invoice: createInvoiceFromRentInvoiceWithRentalProperties(
          {
            invoiceNumber: invoice.invoiceNumber,
            reference: reference,
            roundoff: invoice.roundoff,
            fromDate: new Date(invoice.fromDate),
            toDate: new Date(invoice.toDate),
            invoiceDate: new Date(invoice.invoiceDate),
            expiryDate: new Date(invoice.expiryDate),
            lastDebitDate: invoice.lastDebitDate
              ? new Date(invoice.lastDebitDate)
              : undefined,
            careOf: invoice.careOf ?? undefined,
          },
          rentalPropertiesForInvoice,
          aggregatedRowsWithRoundoff,
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
    const contactCodes = rows.map((row) => row.contactCode)

    const [xpandContacts, xledgerContacts] = await Promise.all([
      getXpandContacts(contactCodes),
      getXledgerContacts(contactCodes),
    ])
    const allContacts = xpandContacts.concat(
      xledgerContacts.map(transformXledgerContactToXpandContact)
    )

    const enrichedInvoices = rows.map((row): EnrichedXledgerRentCase => {
      const contact = allContacts.find((c) => c.contactCode === row.contactCode)
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

    const [invoices, allInvoiceRows] = await Promise.all([
      getInvoices(rows.map((row) => row.invoiceNumber)),
      getInvoiceRows(rows.map((row) => row.invoiceNumber)),
    ])

    const leaseIds = extractLeaseIdsFromInvoiceRows(allInvoiceRows)
    const rentalProperties = await getRentalProperties(
      leaseIds.map(getRentalIdFromLeaseId)
    )

    const enrichedBalanceCorrections = rows.map(
      (row): EnrichedXledgerBalanceCorrection => {
        const invoice = invoices.find(
          (i) => i.invoiceNumber === row.invoiceNumber
        )

        if (invoice) {
          const invoiceRows = allInvoiceRows.filter(
            (ir) => ir.invoiceNumber === invoice.invoiceNumber
          )
          const leaseIdsForInvoice = extractLeaseIdsFromInvoiceRows(invoiceRows)
          const rentalPropertiesForInvoice = rentalProperties.filter(
            (rentalProperty) =>
              leaseIdsForInvoice
                .map(getRentalIdFromLeaseId)
                .includes(rentalProperty.rentalId)
          )

          if (rentalPropertiesForInvoice.length === 0) {
            throw new Error(
              `Rental properties not found for invoice ${invoice.invoiceNumber}`
            )
          }

          const reference = getReferenceForInvoice(
            leaseIdsForInvoice,
            rentalPropertiesForInvoice
          )

          return {
            ...row,
            hasInvoice: true,
            reference: reference,
            lastDebitDate: invoice.lastDebitDate,
            rentalProperty: getMainRentalProperty(rentalPropertiesForInvoice),
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

export const addRoundoffToFirstRow = (
  rows: RentInvoiceRow[],
  roundoff: number
) => {
  if (rows.length === 0) {
    return rows
  }

  return [
    {
      ...rows[0],
      amount: rows[0].amount + roundoff,
    },
    ...rows.slice(1),
  ]
}

export const aggregateRows = (rows: RentInvoiceRow[]): RentInvoiceRow[] => {
  const groups: RentInvoiceRow[][] = []

  // We should rewrite this when we have time
  let i = 0
  while (i < rows.length) {
    const row = rows[i]

    if (row.rowType === 3) {
      // Header row
      const regex = /^[A-Z\d]{3}-[A-Z\d]{3}-[A-Z\d]{2}-[A-Z\d]{4}\/\d{2}/i
      const match = row.text.match(regex)
      if (!match) {
        logger.error(
          { row: JSON.stringify(row) },
          'Row text does not match regular expression for lease ids'
        )
        throw new Error(
          `${row.text} does not match regular expression for lease ids`
        )
      }

      const currentGroup: RentInvoiceRow[] = []

      // Group following rows with same printgroup until we hit a new header or end
      i++
      const printGroup = rows[i].printGroup
      currentGroup.push(rows[i])
      i++

      while (
        i < rows.length &&
        rows[i].rowType !== 3 &&
        rows[i].printGroup === printGroup
      ) {
        currentGroup.push(rows[i])
        i++
      }

      groups.push(currentGroup)
    } else if (row.printGroup === null) {
      // No printgroup, do not group
      groups.push([row])
      i++
    }
  }

  const getMainRow = (groupRows: RentInvoiceRow[]) => {
    return (
      groupRows.find(
        (row) => row.text === 'Hyra bostad' || row.text === 'Hyra p-plats'
      ) ?? groupRows[0]
    )
  }

  return groups.reduce((acc, group) => {
    acc.push({
      ...getMainRow(group),
      amount: group.reduce(
        (sum, row) => sum + row.amount + row.reduction + row.vat,
        0
      ),
    })

    return acc
  }, [])
}

const getRentalIdFromLeaseId = (leaseId: string) => {
  return leaseId.split('/')[0]
}

const extractLeaseIdsFromInvoiceRows = (rows: RentInvoiceRow[]) => {
  const leaseIdRegex = /^[A-Z\d]{3}-[A-Z\d]{3}-[A-Z\d]{2}-[A-Z\d]{4}\/\d{2}/i

  return rows.reduce<string[]>((leaseIds, row) => {
    if (row.rowType === 3) {
      const match = row.text.match(leaseIdRegex)

      if (match) {
        leaseIds.push(match[0])
      }
    }

    return leaseIds
  }, [])
}

const getMainRentalProperty = (rentalProperties: RentalProperty[]) => {
  return (
    rentalProperties.find(
      (property) => property.rentalPropertyType === 'Residence'
    ) ?? rentalProperties[0]
  )
}

const getReferenceForInvoice = (
  leaseIds: string[],
  rentalProperties: RentalProperty[]
) => {
  const mainRentalProperty = getMainRentalProperty(rentalProperties)

  return (
    leaseIds.find(
      (leaseId) =>
        getRentalIdFromLeaseId(leaseId) === mainRentalProperty.rentalId
    ) ?? ''
  )
}

const createInvoiceFromOtherInvoice = (invoice: OtherInvoice): Invoice => {
  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    expiryDate: invoice.expiryDate,
    amount: invoice.remainingAmount,
    comment: invoice.comment ? `       -        Avser: ${invoice.comment}` : '',
    careOf: invoice.careOf,
    rows: [],
    rentalProperties: [],
  }
}

const createInvoiceFromRentInvoiceWithRentalProperties = (
  invoice: RentInvoice,
  rentalProperties: RentalProperty[],
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
    rentalProperties: rentalProperties,
    fromDate: invoice.fromDate,
    toDate: invoice.toDate,
    invoiceDate: invoice.invoiceDate,
    expiryDate: invoice.expiryDate,
    comment: createRentInvoiceComment(
      invoice,
      getMainRentalProperty(rentalProperties)
    ),
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
    rightPad(rentalProperty.postalCode?.replaceAll(' ', '') ?? '', 6, ' '),
    ' ',
    rightPad(rentalProperty.code, 4, ' '),
    ' ',
    rightPad(rentalProperty.address, 32, ' '),
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
