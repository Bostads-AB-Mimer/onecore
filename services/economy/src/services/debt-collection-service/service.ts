import { runWithConcurrency } from '@onecore/utilities'
import {
  getCustomers as getXledgerCustomers,
  XledgerCustomer,
} from '../common/adapters/xledger-adapter'
import {
  getContacts as getXpandContacts,
  getInvoices as getXpandInvoices,
  getInvoiceRows as getXpandInvoiceRows,
  getRentalProperties as getXpandRentalProperties,
} from '../common/adapters/xpand-db-adapter'
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
import {
  AdapterResult,
  InvoiceDeliveryMethod,
  XpandContact,
} from '@src/common/types'
import {
  Contact,
  Invoice,
  InvoiceRow,
  Lease,
  LeaseType,
  RentalProperty,
  RentInvoiceRow,
} from '@onecore/types'
import {
  extractLeaseIdsFromInvoiceRows,
  getRentalIdFromLeaseId,
  XPAND_HEADER_ROW_TYPE,
  XPAND_LEASE_ID_REGEX,
} from '../common/helpers'
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

const TENFAST_CONCURRENCY = 10

/**
 * Looks up each id in Tenfast. Ids Tenfast doesn't know (null) are returned in
 * missingIds so the caller can look for them in Xpand. A failed lookup throws:
 * an unknown result must not be treated as "not in Tenfast".
 */
const getFromTenfast = async <T>(
  ids: string[],
  fetch: (id: string) => Promise<AdapterResult<T | null, string>>
): Promise<{ found: T[]; missingIds: string[] }> => {
  const uniqueIds = [...new Set(ids)]
  const results = await runWithConcurrency(
    uniqueIds,
    async (id) => ({ id, result: await fetch(id) }),
    TENFAST_CONCURRENCY
  )

  const found: T[] = []
  const missingIds: string[] = []
  for (const { id, result } of results) {
    if (!result.ok) {
      throw new Error(result.err)
    }
    if (result.data === null) {
      missingIds.push(id)
    } else {
      found.push(result.data)
    }
  }

  return { found, missingIds }
}

/** Contacts from Tenfast, falling back to Xpand for codes Tenfast lacks. */
const getContactsFromTenfastAndXpand = async (
  contactCodes: string[]
): Promise<Contact[]> => {
  const tenfast = await getFromTenfast(contactCodes, getContactByContactCode)
  const xpandContacts = await getXpandContacts(tenfast.missingIds)

  return [...tenfast.found, ...xpandContacts]
}

/**
 * Rental properties from Tenfast, falling back to Xpand for ids Tenfast
 * lacks.
 */
const getRentalPropertiesFromTenfastAndXpand = async (
  rentalPropertyIds: string[]
): Promise<RentalProperty[]> => {
  const tenfast = await getFromTenfast(rentalPropertyIds, getRentalProperty)
  const xpandRentalProperties = await getXpandRentalProperties(
    tenfast.missingIds
  )

  return [...tenfast.found, ...xpandRentalProperties]
}

type RentInvoiceLookup = {
  tenfastInvoices: Invoice[]
  xpandInvoices: RentInvoice[]
  xpandInvoiceRows: RentInvoiceRow[]
  leases: Lease[]
  rentalProperties: RentalProperty[]
}

/**
 * Finds each invoice in Tenfast, falling back to Xpand. Then fetches the
 * leases and rental properties those invoices refer to. Leases only come from
 * Tenfast (Xpand invoices carry their lease ids in their rows); rental
 * properties fall back to Xpand.
 */
const getRentInvoicesFromTenfastAndXpand = async (
  invoiceNumbers: string[]
): Promise<RentInvoiceLookup> => {
  const tenfast = await getFromTenfast(invoiceNumbers, async (ocr) => {
    const result = await getInvoiceByOcr(ocr)
    return result.ok
      ? { ok: true, data: result.data?.invoice ?? null }
      : { ok: false, err: result.err }
  })

  const [xpandInvoices, xpandInvoiceRows, tenfastLeases] = await Promise.all([
    getXpandInvoices(tenfast.missingIds),
    getXpandInvoiceRows(tenfast.missingIds),
    getFromTenfast(
      tenfast.found.flatMap((i) => i.leaseIds),
      getLease
    ),
  ])

  const rentalPropertyIds = [
    ...tenfast.found.flatMap((invoice) =>
      getRentalPropertyIdsForTenfastInvoice(invoice, tenfastLeases.found)
    ),
    ...extractLeaseIdsFromInvoiceRows(xpandInvoiceRows).map(
      getRentalIdFromLeaseId
    ),
  ]
  const rentalProperties =
    await getRentalPropertiesFromTenfastAndXpand(rentalPropertyIds)

  return {
    tenfastInvoices: tenfast.found,
    xpandInvoices,
    xpandInvoiceRows,
    leases: tenfastLeases.found,
    rentalProperties,
  }
}

/**
 * The rental property of each of the invoice's leases. A lease missing from
 * Tenfast falls back to the rental id in its lease id.
 */
const getRentalPropertyIdsForTenfastInvoice = (
  invoice: Invoice,
  leases: Lease[]
): string[] =>
  invoice.leaseIds.map(
    (leaseId) =>
      leases.find((l) => l.leaseId === leaseId)?.rentalPropertyId ??
      getRentalIdFromLeaseId(leaseId)
  )

/** Last debit date of the invoice's main lease, if any lease is in Tenfast. */
const getLastDebitDateForTenfastInvoice = (
  invoice: Invoice,
  leases: Lease[]
): Date | undefined => {
  const leasesForInvoice = leases.filter((l) =>
    invoice.leaseIds.includes(l.leaseId)
  )

  return leasesForInvoice.length > 0
    ? getMainLease(leasesForInvoice).lastDebitDate
    : undefined
}

/** The Xpand invoice's rows, lease ids, rental properties and reference. */
const getXpandInvoiceDetails = (
  invoice: RentInvoice,
  lookup: RentInvoiceLookup
) => {
  const invoiceRows = lookup.xpandInvoiceRows.filter(
    (ir) => ir.invoiceNumber === invoice.invoiceNumber
  )
  const leaseIds = extractLeaseIdsFromInvoiceRows(invoiceRows)
  const rentalIds = leaseIds.map(getRentalIdFromLeaseId)
  const rentalProperties = lookup.rentalProperties.filter((r) =>
    rentalIds.includes(r.rentalPropertyId)
  )

  if (rentalProperties.length === 0) {
    throw new Error(
      `Rental properties not found for invoice ${invoice.invoiceNumber}`
    )
  }

  return {
    invoiceRows,
    rentalProperties,
    reference: getReferenceForInvoice(leaseIds, rentalProperties),
  }
}

export const enrichRentInvoices = async (
  csv: string
): Promise<EnrichResponse> => {
  try {
    const rows = importInvoicesFromCsv(csv, ';')

    const [contacts, lookup] = await Promise.all([
      getContactsFromTenfastAndXpand(rows.map((row) => row.contactCode)),
      getRentInvoicesFromTenfastAndXpand(rows.map((row) => row.invoiceNumber)),
    ])

    const enrichedInvoices = rows.map((row): EnrichedXledgerRentCase => {
      const contact = contacts.find((c) => c.contactCode === row.contactCode)
      if (!contact) {
        // TODO how to handle this?
        throw new Error(
          `Contact not found for contact code '${row.contactCode}'`
        )
      }
      const amountPaid = row.totalAmount - row.remainingAmount

      const xpandInvoice = lookup.xpandInvoices.find(
        (i) => i.invoiceNumber === row.invoiceNumber
      )
      if (xpandInvoice) {
        const { invoiceRows, rentalProperties, reference } =
          getXpandInvoiceDetails(xpandInvoice, lookup)

        return {
          ...row,
          contact,
          invoice: createInvoiceFromRentInvoiceWithRentalProperties(
            { ...xpandInvoice, reference },
            rentalProperties,
            addRoundoffToFirstRow(
              aggregateXpandRows(invoiceRows),
              xpandInvoice.roundoff ?? 0
            ).map(toInvoiceRow),
            amountPaid
          ),
        }
      }

      const invoice = lookup.tenfastInvoices.find(
        (i) => i.invoiceId === row.invoiceNumber
      )
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

      const rentalPropertyIds = getRentalPropertyIdsForTenfastInvoice(
        invoice,
        lookup.leases
      )
      const rentalPropertiesForInvoice = lookup.rentalProperties.filter((r) =>
        rentalPropertyIds.includes(r.rentalPropertyId)
      )
      if (rentalPropertiesForInvoice.length === 0) {
        throw new Error(
          `Rental properties not found for invoice ${invoice.invoiceId}`
        )
      }

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
            lastDebitDate: getLastDebitDateForTenfastInvoice(
              invoice,
              lookup.leases
            ),
            careOf: contact.careOf ?? undefined,
          },
          rentalPropertiesForInvoice,
          aggregateRows(invoice.invoiceRows),
          amountPaid
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

    const [contacts, xledgerCustomers] = await Promise.all([
      getContactsFromTenfastAndXpand(contactCodes),
      getXledgerCustomers(contactCodes),
    ])
    const allContacts = contacts.concat(
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

    const lookup = await getRentInvoicesFromTenfastAndXpand(
      rows.map((row) => row.invoiceNumber)
    )

    const enrichedBalanceCorrections = rows.map(
      (row): EnrichedXledgerBalanceCorrection => {
        const xpandInvoice = lookup.xpandInvoices.find(
          (i) => i.invoiceNumber === row.invoiceNumber
        )
        if (xpandInvoice) {
          const { rentalProperties, reference } = getXpandInvoiceDetails(
            xpandInvoice,
            lookup
          )

          return {
            ...row,
            hasInvoice: true,
            reference,
            lastDebitDate: xpandInvoice.lastDebitDate,
            rentalProperty: getMainRentalProperty(rentalProperties),
          }
        }

        const invoice = lookup.tenfastInvoices.find(
          (i) => i.invoiceId === row.invoiceNumber
        )

        if (invoice) {
          const rentalPropertiesForInvoice = lookup.rentalProperties.filter(
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

          return {
            ...row,
            hasInvoice: true,
            reference: reference,
            lastDebitDate: getLastDebitDateForTenfastInvoice(
              invoice,
              lookup.leases
            ),
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

/**
 * Aggregates Xpand invoice rows. A header row (rowType 3, text starts with a
 * lease id) is followed by the rows of its print group; each group becomes one
 * row. Other rows stay as they are. Amounts include reduction and VAT, which
 * Xpand stores as amounts.
 */
export const aggregateXpandRows = (
  rows: RentInvoiceRow[]
): RentInvoiceRow[] => {
  const groups: RentInvoiceRow[][] = []

  let i = 0
  while (i < rows.length) {
    const row = rows[i]

    if (row.rowType !== XPAND_HEADER_ROW_TYPE) {
      groups.push([row])
      i++
      continue
    }

    if (!XPAND_LEASE_ID_REGEX.test(row.text)) {
      throw new Error(
        `${row.text} does not match regular expression for lease ids`
      )
    }

    // Skip the header and group the following rows that share its first
    // row's print group
    i++
    if (i >= rows.length) {
      break
    }
    const currentGroup: RentInvoiceRow[] = [rows[i]]
    const printGroup = rows[i].printGroup
    i++

    while (
      i < rows.length &&
      rows[i].rowType !== XPAND_HEADER_ROW_TYPE &&
      rows[i].printGroup === printGroup
    ) {
      currentGroup.push(rows[i])
      i++
    }

    groups.push(currentGroup)
  }

  return groups.map((group) => ({
    ...(group.find(
      (row) => row.text === 'Hyra bostad' || row.text === 'Hyra p-plats'
    ) ?? group[0]),
    amount: group.reduce(
      (sum, row) => sum + row.amount + row.reduction + row.vat,
      0
    ),
  }))
}

export const addRoundoffToFirstRow = (
  rows: RentInvoiceRow[],
  roundoff: number
): RentInvoiceRow[] => {
  if (rows.length === 0) {
    return rows
  }

  return [{ ...rows[0], amount: rows[0].amount + roundoff }, ...rows.slice(1)]
}

/**
 * Maps an aggregated Xpand row to the Tenfast row shape the converters use.
 * Its amount already includes reduction and VAT, so those are zero.
 */
export const toInvoiceRow = (row: RentInvoiceRow): InvoiceRow => ({
  amount: row.amount,
  deduction: 0,
  vat: 0,
  roundoff: 0,
  totalAmount: row.amount,
  fromDate: row.fromDate.toISOString(),
  toDate: row.toDate.toISOString(),
  // Not used by the debt collection files
  invoiceDate: '',
  invoiceDueDate: '',
  invoiceNumber: row.invoiceNumber,
  invoiceRowText: row.text,
  printGroup: row.printGroup,
  rentArticle: row.code,
  rowType: row.rowType,
})

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
  /*
    If the invoice is partially paid, we need to subtract the paid amount from the invoice row amounts.
    If an invoice row is fully paid this way, it is removed.
    Invoice rows for "Hyra bostad" (residence) should be paid first, and rows for "Mimers hemförsäkring" (home insurance) last.
    Other invoice rows can be in any order.
  */
  const removePaidAmountFromInvoiceRows = (
    rows: InvoiceRow[],
    paid: number
  ): InvoiceRow[] => {
    if (paid === 0 || rows.length === 0) {
      return rows
    }

    /*
      Put "Hyra bostad"-rows first and "Mimers hemförsäkring"-rows last.
    */
    const sorted = rows.sort((a, b) => {
      const aInvoiceRowLowerCase = a.invoiceRowText?.toLowerCase()
      const bInvoiceRowLowerCase = b.invoiceRowText?.toLowerCase()

      if (aInvoiceRowLowerCase === 'mimers hemförsäkring') {
        return 1
      }

      if (bInvoiceRowLowerCase === 'mimers hemförsäkring') {
        return -1
      }

      if (aInvoiceRowLowerCase === 'hyra bostad') {
        return -1
      }

      if (bInvoiceRowLowerCase === 'hyra bostad') {
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

  const unpaidRows = removePaidAmountFromInvoiceRows(rows, amountPaid)

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
