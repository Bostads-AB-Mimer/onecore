import { Email, Sms } from './types'

interface ParkingSpaceOfferEmail extends Email {
  contactCode: string
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
  contactCode: string
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

// Sidecar meta on bulk-send requests; shapes the dispatch row, not the send itself.
interface CommunicationLogMeta {
  triggeredByUser?: string
  audienceCriteria?: Record<string, unknown>
  templateId?: string
}

interface BulkSmsRecipient {
  contactCode?: string
  phoneNumber: string
}

interface BulkEmailRecipient {
  contactCode?: string
  emailAddress: string
}

// Either phoneNumbers or recipients required.
interface BulkSms {
  phoneNumbers?: string[]
  recipients?: BulkSmsRecipient[]
  text: string
  logMeta?: CommunicationLogMeta
}

// Either emails or recipients required.
interface BulkEmail {
  emails?: string[]
  recipients?: BulkEmailRecipient[]
  subject: string
  text: string
  logMeta?: CommunicationLogMeta
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

interface InspectionProtocolEmail extends Email {
  firstName: string
}

// Can be used for both positive and negative notifications
interface ParkingSpaceNotificationEmail extends Email {
  address: string
  parkingSpaceId: string
}

// External (NON_SCORED) parking space application emails.
// triggeredBy is the admin who initiated the lease creation (the approve/deny
// outcome follows from their action), used for communication-log attribution.
interface NonScoredParkingSpaceApprovedEmail extends Email {
  contactCode: string
  triggeredBy?: string
  leaseId: string
  address: string
  availableFrom: string
  parkingSpaceId: string
  objectId: string
  type: string
  rent: string
}

interface NonScoredParkingSpaceDeniedEmail extends Email {
  contactCode: string
  triggeredBy?: string
  address: string
  availableFrom: string
  parkingSpaceId: string
  objectId: string
  type: string
  rent: string
}

export type {
  ParkingSpaceOfferEmail,
  ParkingSpaceNotificationEmail,
  ParkingSpaceAcceptOfferEmail,
  ParkingSpaceOfferSms,
  WorkOrderSms,
  WorkOrderEmail,
  InspectionProtocolEmail,
  CommunicationLogMeta,
  BulkSms,
  BulkSmsRecipient,
  BulkEmail,
  BulkEmailRecipient,
  BulkSmsResult,
  BulkEmailResult,
  NonScoredParkingSpaceApprovedEmail,
  NonScoredParkingSpaceDeniedEmail,
}
