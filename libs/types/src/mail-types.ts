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

interface WorkOrderSms extends Sms {
  message: string
  useTemplate: boolean
}

interface WorkOrderEmail extends Email {
  useTemplate: boolean
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
  WorkOrderSms,
  WorkOrderEmail,
}
