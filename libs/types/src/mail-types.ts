import { Email, Sms } from './types'

interface ParkingSpaceOfferEmail extends Email {
  address: string
  firstName: string
  availableFrom: string
  deadlineDate: string
  rent: string
  type: string
  parkingSpaceId: string
  objectId: string
  applicationType: 'Replace' | 'Additional'
  offerURL: string
}

interface ParkingSpaceAcceptOfferEmail extends Email {
  address: string
  firstName: string
  availableFrom: string
  rent: string
  type: string
  parkingSpaceId: string
  objectId: string
}

interface ParkingSpaceOfferSms extends Sms {
  firstName: string
  deadlineDate: string
}

interface WorkOrderSms extends Sms {
  text: string
  externalContractorName?: string
}

interface BulkSms {
  phoneNumbers: string[]
  text: string
}

interface BulkEmail {
  emails: string[]
  subject: string
  text: string
}

interface BulkSmsResult {
  successful: string[]
  invalid: string[]
  totalSent: number
  totalInvalid: number
}

interface BulkEmailResult {
  successful: string[]
  invalid: string[]
  totalSent: number
  totalInvalid: number
}

interface WorkOrderEmail extends Email {
  externalContractorName?: string
}

// Can be used for both positive and negative notifications
interface ParkingSpaceNotificationEmail extends Email {
  address: string
  parkingSpaceId: string
}

export type {
  ParkingSpaceOfferEmail,
  ParkingSpaceNotificationEmail,
  ParkingSpaceAcceptOfferEmail,
  ParkingSpaceOfferSms,
  WorkOrderSms,
  WorkOrderEmail,
  BulkSms,
  BulkEmail,
  BulkSmsResult,
  BulkEmailResult,
}
