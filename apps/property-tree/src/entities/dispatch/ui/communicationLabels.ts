import type {
  DispatchListItem,
  MessageRecipient,
} from '@/services/api/core/communicationService'

type Channel = DispatchListItem['channel']
type DispatchStatus = DispatchListItem['status']
type RecipientStatus = MessageRecipient['status']

export const channelLabel = (channel: Channel) =>
  channel === 'sms' ? 'SMS' : 'E-post'

// Per-recipient delivery status (8 values from the provider lifecycle).
export const RECIPIENT_STATUS_META: Record<
  RecipientStatus,
  { label: string; className: string }
> = {
  delivered: {
    label: 'Levererat',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  sent: {
    label: 'Skickat',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  received: {
    label: 'Mottaget',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  pending: {
    label: 'Väntar',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  scheduled: {
    label: 'Schemalagt',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  cancelled: {
    label: 'Avbrutet',
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  },
  failed: {
    label: 'Misslyckades',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  bounced: {
    label: 'Studsade',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
}

// Dispatch-level status, derived from recipient rows server-side (MIM-1911).
export const DISPATCH_STATUS_META: Record<
  DispatchStatus,
  { label: string; className: string }
> = {
  scheduled: {
    label: 'Schemalagt',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  sending: {
    label: 'Skickar',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  delivered: {
    label: 'Levererat',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  partially_delivered: {
    label: 'Delvis levererat',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  failed: {
    label: 'Misslyckades',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  cancelled: {
    label: 'Avbrutet',
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  },
}
