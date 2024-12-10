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

interface ParkingSpaceOfferSms extends Sms {
  firstName: string
  deadlineDate: string
}

interface TicketMessageSms extends Sms {
  message: string
}

// Can be used for both positive and negative notifications
interface ParkingSpaceNotificationEmail extends Email {
  address: string
  parkingSpaceId: string
}

export type {
  ParkingSpaceOfferEmail,
  ParkingSpaceNotificationEmail,
  ParkingSpaceOfferSms,
  TicketMessageSms,
}
