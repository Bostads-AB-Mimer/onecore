import { Contact } from '@onecore/types'
import {
  RentInvoiceRow,
  EnrichedXledgerRentCase,
  Invoice,
} from '../../common/types'
import {
  formatNumber,
  getDateString,
  joinStrings,
  leftPad,
  rightPad,
} from './utils'

const Header = "INKASSOIDPOST+100284+INKASSO+new_cases'"
const MimerCustomerId = '1681340'

type DebtorSection = {
  contact: Contact
  invoices: Invoice[]
}

export default (
  cases: EnrichedXledgerRentCase[],
  createdDate: Date
): string => {
  const debtors = cases.reduce<Record<string, DebtorSection>>(
    (acc, rentCase) => {
      const { contactCode, contact, invoice } = rentCase
      if (!acc[contactCode]) {
        acc[contactCode] = { contact, invoices: [] }
      }

      acc[contactCode].invoices.push(invoice)

      return acc
    },
    {}
  )

  return joinStrings(
    [
      Header,
      `100${getDateString(createdDate)}`,
      ...Object.values(debtors).map(createDebtorSection),
      createEndPost(Object.values(debtors)),
    ],
    '\n'
  )
}

const getContactPhoneNumber = (contact: Contact) => {
  if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) {
    return null
  }

  return contact.phoneNumbers[0].phoneNumber
}

const createInvoiceSumRow = (invoice: Invoice): string => {
  return joinStrings([
    '130',
    getDateString(invoice.invoiceDate),
    getDateString(invoice.expiryDate),
    rightPad('', 5, ' '), // Postnummer? Ej med i exempelfiler men med i spec
    invoice.reference ? 'A' : 'F',
    rightPad('', 4, ' '), // Räntesats
    ' ', // Över gällande diskonto
    leftPad(formatNumber(invoice.amount), 12, '0'),
    rightPad(invoice.invoiceNumber, 20, ' '),
    invoice.comment,
  ])
}

const createInvoiceRow = (invoice: Invoice, row: RentInvoiceRow): string => {
  const {
    reference = '',
    invoiceDate,
    expiryDate,
    invoiceNumber,
    fromDate,
    toDate,
  } = invoice

  return joinStrings([
    '140',
    getDateString(invoiceDate),
    getDateString(expiryDate),
    rightPad('', 5, ' '),
    reference ? 'A' : 'F',
    rightPad('', 5, ' '),
    leftPad(formatNumber(row.amount), 12, '0'),
    rightPad(invoiceNumber, 20, ' '),
    reference,
    ' ',
    rightPad(
      fromDate && toDate
        ? `${getDateString(fromDate)}-${getDateString(toDate)}`
        : '',
      13,
      ' '
    ),
    '  ',
    `Avser: ${row.text}`,
  ])
}

const createDebtorSection = (debtor: DebtorSection): string => {
  if (!debtor.contact.address) {
    throw new Error('Contact must have an address')
  }

  const lines: string[] = []
  const post110SubStrings: string[] = [
    '110',
    `${MimerCustomerId}${debtor.contact.contactCode}`,
  ]

  const { reference = '', careOf, lastDebitDate } = debtor.invoices[0]

  if (lastDebitDate) {
    post110SubStrings.push(
      [
        rightPad('', 9, ' '),
        rightPad(reference.replaceAll('-', ''), 20, ' '),
        getDateString(lastDebitDate),
        reference,
      ].join('')
    )
  }
  lines.push(joinStrings(post110SubStrings))

  lines.push(
    joinStrings([
      '120',
      ' ',
      debtor.contact.nationalRegistrationNumber.replaceAll('-', ''),
      rightPad(debtor.contact.fullName, 36, ' '),
      rightPad(debtor.contact.address.street ?? '', 36, ' '),
      debtor.contact.address.postalCode.replaceAll(' ', ''),
      rightPad(debtor.contact.address.city, 28, ' '),
      rightPad(
        getContactPhoneNumber(debtor.contact)
          ?.replaceAll('-', '')
          .replaceAll(' ', '') ?? '',
        12,
        ' '
      ),
      'J', // Kan denna vara B?
    ])
  )

  if (careOf) {
    lines.push(`121c/o ${careOf}`)
  }

  debtor.invoices.forEach((invoice) => {
    lines.push(
      joinStrings([
        '129',
        rightPad('', 60, ' '), // Internt dokument-id
        rightPad('', 30, ' '), // Temporärt ärendenummer
        rightPad('', 3, ' '), // Fakturatyp
        'SEK',
        reference
          ? rightPad(reference.replaceAll('-', ''), 20, ' ')
          : rightPad('', 20, ' '),
        lastDebitDate ? getDateString(lastDebitDate) : '',
      ])
    )
    lines.push(createInvoiceSumRow(invoice))
    lines.push(
      ...invoice.rows.map((invoiceRow) => createInvoiceRow(invoice, invoiceRow))
    )
  })

  return lines.join('\n')
}

const createEndPost = (debtors: DebtorSection[]) => {
  const allInvoices = debtors.flatMap((row) => row.invoices)
  const allInvoiceRows = allInvoices.flatMap((invoice) => invoice.rows)
  // TODO detta borde gå att göra snyggare
  const totalAmount =
    allInvoiceRows.length > 0
      ? allInvoices
          .flatMap((invoice) => invoice.rows)
          .reduce((sum, row) => sum + row.amount, 0)
      : debtors
          .map((debtor) => debtor.invoices)
          .reduce((sum, invoice) => sum + invoice[0].amount, 0)

  return joinStrings([
    '199',
    leftPad(allInvoices.length, 10, '0'),
    leftPad(debtors.length, 10, '0'), // assuming one 110-post per debtor
    leftPad(formatNumber(totalAmount), 15, '0'),
  ])
}
