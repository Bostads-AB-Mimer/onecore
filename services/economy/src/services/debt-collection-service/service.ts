import {
  getCustomers as getXledgerCustomers,
  XledgerCustomer,
} from '../common/adapters/xledger-adapter'
import generateBalanceCorrectionFile from './converters/generateBalanceCorrectionFile'
import generateInkassoSergelFile from './converters/generateInkassoSergelFile'
import { getDateString, joinStrings, rightPad } from './converters/utils'
import {
  DebtCollectionInvoice,
  EnrichedXledgerRentCase,
  OtherInvoice,
  XledgerBalanceCorrection,
  XledgerBalanceCorrectionColumnIndexes,
  XledgerRentCase,
  XledgerRentCaseColumnIndexes,
  RentInvoice,
  EnrichedXledgerBalanceCorrection,
} from '../common/types'
import { InvoiceDeliveryMethod, XpandContact } from '@src/common/types'
import {
  Contact,
  Invoice,
  InvoiceRow,
  Lease,
  LeaseType,
  RentalProperty,
} from '@onecore/types'
import { getRentalIdFromLeaseId } from '../common/helpers'
import {
  getContactByContactCode,
  getInvoiceByOcr,
  getLease,
  getRentalProperty,
} from '@src/common/adapters/tenfast/tenfast-adapter'

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

const transformXledgerCustomerToXpandContact = (
  xledgerCustomer: XledgerCustomer
): XpandContact => {
  return {
    contactCode: xledgerCustomer.contactCode,
    address: {
      street: xledgerCustomer.address.street,
      city: xledgerCustomer.address.city,
      postalCode: xledgerCustomer.address.postalCode,
      number: '',
    },
    fullName: xledgerCustomer.fullName,
    nationalRegistrationNumber: xledgerCustomer.nationalRegistrationNumber,
    phoneNumbers: [
      {
        phoneNumber: xledgerCustomer.phoneNumber ?? '',
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
    protectedIdentity: false,
    deceased: false,
    emigrated: false,
    noAdvertising: false,
  }
}

export type EnrichResponse =
  | {
      ok: true
      file: string
    }
  | { ok: false; error: Error }

const getTenfastContacts = async (
  contactCodes: string[]
): Promise<Contact[]> => {
  const contacts: Contact[] = []

  for (const contactCode of contactCodes) {
    const contactResult = await getContactByContactCode(contactCode)
    if (!contactResult.ok) {
      throw new Error(contactResult.err)
    }

    contacts.push(contactResult.data)
  }

  return contacts
}

const getTenfastInvoices = async (ocrs: string[]): Promise<Invoice[]> => {
  const invoices: Invoice[] = []

  for (const ocr of ocrs) {
    const invoiceResult = await getInvoiceByOcr(ocr)
    if (!invoiceResult.ok) {
      throw new Error(invoiceResult.err)
    }

    invoices.push(invoiceResult.data.invoice)
  }

  return invoices
}

const getTenfastLeases = async (leaseIds: string[]): Promise<Lease[]> => {
  const leases: Lease[] = []

  for (const leaseId of leaseIds) {
    const leaseResult = await getLease(leaseId)
    if (!leaseResult.ok) {
      throw new Error(leaseResult.err)
    }

    leases.push(leaseResult.data)
  }

  return leases
}

const getTenfastRentalProperties = async (
  rentalPropertyIds: string[]
): Promise<RentalProperty[]> => {
  const rentalProperties: RentalProperty[] = []

  for (const rentalPropertyId of rentalPropertyIds) {
    const rentalPropertyResult = await getRentalProperty(rentalPropertyId)
    if (!rentalPropertyResult.ok) {
      throw new Error(rentalPropertyResult.err)
    }

    rentalProperties.push(rentalPropertyResult.data)
  }

  return rentalProperties
}

export const enrichRentInvoices = async (
  csv: string
): Promise<EnrichResponse> => {
  try {
    const rows = importInvoicesFromCsv(csv, ';')

    const [contacts, invoices] = await Promise.all([
      getTenfastContacts(rows.map((row) => row.contactCode)),
      getTenfastInvoices(rows.map((row) => row.invoiceNumber)),
    ])

    const leases = await getTenfastLeases(invoices.flatMap((i) => i.leaseIds))
    const rentalProperties = await getTenfastRentalProperties(
      leases.map((l) => l.rentalPropertyId)
    )

    const enrichedInvoices = rows.map((row): EnrichedXledgerRentCase => {
      const contact = contacts.find((c) => c.contactCode === row.contactCode)
      if (!contact) {
        // TODO how to handle this?
        throw new Error(
          `Contact not found for contact code '${row.contactCode}'`
        )
      }
      const invoice = invoices.find((i) => i.invoiceId === row.invoiceNumber)
      if (!invoice) {
        // TODO how to handle this?
        throw new Error(
          `Invoice not found for invoice number '${row.invoiceNumber}'`
        )
      }
      if (!invoice.expirationDate) {
        throw new Error(
          `Invoice ${invoice.invoiceId} does not have an expiration date`
        )
      }

      const leasesForInvoice = leases.filter((l) =>
        invoice.leaseIds.includes(l.leaseId)
      )

      const rentalPropertiesForInvoice = rentalProperties.filter((r) =>
        leasesForInvoice.some((l) => l.rentalPropertyId === r.rentalPropertyId)
      )
      const mainLease = getMainLease(leasesForInvoice)
      const invoiceRows = aggregateRows(invoice.invoiceRows)

      return {
        ...row,
        contact,
        invoice: createInvoiceFromRentInvoiceWithRentalProperties(
          {
            invoiceNumber: invoice.invoiceId,
            reference: invoice.reference,
            fromDate: new Date(invoice.fromDate),
            toDate: new Date(invoice.toDate),
            invoiceDate: new Date(invoice.invoiceDate),
            expiryDate: invoice.expirationDate,
            lastDebitDate: mainLease.lastDebitDate,
            careOf: contact.careOf ?? undefined,
          },
          rentalPropertiesForInvoice,
          invoiceRows,
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

    const [tenfastContacts, xledgerCustomers] = await Promise.all([
      getTenfastContacts(contactCodes),
      getXledgerCustomers(contactCodes),
    ])
    const allContacts = tenfastContacts.concat(
      xledgerCustomers.map(transformXledgerCustomerToXpandContact)
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

    const [invoices] = await Promise.all([
      getTenfastInvoices(rows.map((row) => row.invoiceNumber)),
    ])

    const leases = await getTenfastLeases(invoices.flatMap((i) => i.leaseIds))
    const rentalProperties = await getTenfastRentalProperties(
      leases.map((l) => l.rentalPropertyId)
    )

    const enrichedBalanceCorrections = rows.map(
      (row): EnrichedXledgerBalanceCorrection => {
        const invoice = invoices.find((i) => i.invoiceId === row.invoiceNumber)

        if (invoice) {
          const leasesForInvoice = leases.filter((l) =>
            invoice.leaseIds.some((id) => id === l.leaseId)
          )

          const rentalPropertiesForInvoice = rentalProperties.filter(
            (rentalProperty) =>
              invoice.leaseIds
                .map(getRentalIdFromLeaseId)
                .includes(rentalProperty.rentalPropertyId)
          )

          if (rentalPropertiesForInvoice.length === 0) {
            throw new Error(
              `Rental properties not found for invoice ${invoice.invoiceId}`
            )
          }

          const reference = getReferenceForInvoice(
            invoice.leaseIds,
            rentalPropertiesForInvoice
          )

          const mainLease = getMainLease(leasesForInvoice)

          return {
            ...row,
            hasInvoice: true,
            reference: reference,
            lastDebitDate: mainLease.lastDebitDate,
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

export const aggregateRows = (rows: InvoiceRow[]): InvoiceRow[] => {
  const groups: InvoiceRow[][] = []

  rows.forEach((row) => {
    if (!row.printGroup) {
      groups.push([row])
      return
    }

    const existingGroup = groups.find((g) => g[0].printGroup === row.printGroup)

    if (existingGroup) {
      existingGroup.push(row)
    } else {
      groups.push([row])
    }
  })

  const getMainRow = (groupRows: InvoiceRow[]) => {
    return (
      groupRows.find(
        (row) =>
          row.invoiceRowText === 'Hyra bostad' ||
          row.invoiceRowText === 'Hyra p-plats'
      ) ?? groupRows[0]
    )
  }

  return groups.reduce((acc, group) => {
    acc.push({
      ...getMainRow(group),
      amount: group.reduce(
        (sum, row) => sum + (row.amount + row.deduction) * (1 + row.vat),
        0
      ),
    })

    return acc
  }, [])
}

const getMainLease = (leases: Lease[]) => {
  if (leases.length === 0) {
    throw new Error('getMainLease requires at least one lease')
  }

  return leases.find((l) => l.type === LeaseType.HousingContract) ?? leases[0]
}

const getMainRentalProperty = (rentalProperties: RentalProperty[]) => {
  return (
    rentalProperties.find(
      (property) => property.rentalPropertyType === 'bostad'
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
        getRentalIdFromLeaseId(leaseId) === mainRentalProperty.rentalPropertyId
    ) ?? ''
  )
}

const createInvoiceFromOtherInvoice = (
  invoice: OtherInvoice
): DebtCollectionInvoice => {
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
  rows: InvoiceRow[],
  amountPaid: number
): DebtCollectionInvoice => {
  const removePaidRows = (rows: InvoiceRow[], paid: number): InvoiceRow[] => {
    if (paid === 0 || rows.length === 0) {
      return rows
    }

    const sorted = rows.sort((a, b) => {
      if (a.invoiceRowText === 'Hemförsäkring') {
        return 1
      }

      if (b.invoiceRowText === 'Hemförsäkring') {
        return -1
      }

      if (a.invoiceRowText === 'Hyra bostad') {
        return -1
      }

      if (b.invoiceRowText === 'Hyra bostad') {
        return 1
      }

      return 0
    })

    const remainingRows: InvoiceRow[] = []

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
    rightPad(
      rentalProperty.address?.postalCode?.replaceAll(' ', '') ?? '',
      6,
      ' '
    ),
    ' ',
    rightPad(rentalProperty.rentalPropertyId, 4, ' '),
    ' ',
    rightPad(rentalProperty.address?.street ?? '', 32, ' '),
    rightPad(rentalProperty.type, 30, ' '),
    rightPad(
      `Area: ${rentalProperty.size?.toFixed(1).replace('.', ',') ?? '0,0'}`,
      20,
      ' '
    ),
    rentalProperty.rentalPropertyType === 'bostad'
      ? 'Vid ev avhysning, måste förråd tömmas!'
      : '',
  ])
}

export class CsvError extends Error {
  constructor(message: string) {
    super(message)
  }
}
