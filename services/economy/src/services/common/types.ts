import { Contact } from '@onecore/types'

export type XledgerRentCase = {
  contactCode: string
  invoiceNumber: string
  invoiceDate: Date
  expiryDate: Date
  totalAmount: number
  remainingAmount: number
  comment?: string
}

export const XledgerRentCaseColumnIndexes = {
  contactCode: 0,
  invoiceNumber: 1,
  invoiceDate: 2,
  expiryDate: 3,
  totalAmount: 4,
  remainingAmount: 5,
  comment: 6,
}

export type XledgerBalanceCorrection = {
  contactCode: string
  type: string
  invoiceNumber: string
  date: Date
  paidAmount: number
  remainingAmount: number
}

export const XledgerBalanceCorrectionColumnIndexes = {
  contactCode: 0,
  type: 1,
  invoiceNumber: 2,
  date: 3,
  paidAmount: 4,
  remainingAmount: 5,
}

export type EnrichedXledgerBalanceCorrection = XledgerBalanceCorrection &
  (
    | {
        hasInvoice: true
        reference: string
        rentalProperty: RentalProperty
        lastDebitDate?: Date
      }
    | {
        hasInvoice: false
      }
  )

export type RentInvoiceRow = {
  type: 'Rent' | 'Other'
  invoiceNumber: string
  text: string
  rentType: string | null
  code: string | null
  rowType: number
  amount: number
  reduction: number
  vat: number
  printGroup: string | null
  comment?: string
}

export type RentalProperty = {
  rentalPropertyType: 'Residence' | 'ParkingSpace' | 'Facility' | 'Other'
  rentalId: string
  address: string
  code: string
  postalCode: string | null
  city: string | null
  type: string
  areaSize: number | null
}

export type RentInvoice = {
  invoiceNumber: string
  reference: string
  roundoff: number
  fromDate: Date
  toDate: Date
  invoiceDate: Date
  expiryDate: Date
  lastDebitDate?: Date
  careOf?: string
}

export type OtherInvoice = {
  invoiceNumber: string
  totalAmount: number
  remainingAmount: number
  invoiceDate: Date
  expiryDate: Date
  careOf?: string
  comment?: string
}

export type Invoice = {
  invoiceNumber: string
  invoiceDate: Date
  expiryDate: Date
  amount: number
  rows: RentInvoiceRow[]
  comment: string
  reference?: string
  fromDate?: Date
  toDate?: Date
  rentalProperties: RentalProperty[]
  lastDebitDate?: Date
  careOf?: string
}

export type EnrichedXledgerRentCase = XledgerRentCase & {
  contact: Contact
  invoice: Invoice
}
