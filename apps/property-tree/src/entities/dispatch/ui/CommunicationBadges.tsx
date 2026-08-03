import { Mail, MessageSquare } from 'lucide-react'

import type {
  DispatchListItem,
  MessageRecipient,
} from '@/services/api/core/communicationService'

import { Badge } from '@/shared/ui/Badge'

type Channel = DispatchListItem['channel']
type DispatchStatus = DispatchListItem['status']
type RecipientStatus = MessageRecipient['status']

const channelLabel = (channel: Channel) =>
  channel === 'sms' ? 'SMS' : 'E-post'

export function ChannelBadge({ channel }: { channel: Channel }) {
  const isSms = channel === 'sms'
  return (
    <Badge
      variant="outline"
      className={`gap-1 px-2 py-0.5 ${
        isSms
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-purple-50 text-purple-700 border-purple-200'
      }`}
    >
      {isSms ? (
        <MessageSquare className="h-3 w-3" />
      ) : (
        <Mail className="h-3 w-3" />
      )}
      {channelLabel(channel)}
    </Badge>
  )
}

// Per-recipient delivery status (8 values from the provider lifecycle).
const RECIPIENT_STATUS_META: Record<
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

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  const meta = RECIPIENT_STATUS_META[status]
  return (
    <Badge variant="outline" className={`px-2 py-0.5 ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

// Dispatch-level status, derived from recipient rows server-side (MIM-1911).
const DISPATCH_STATUS_META: Record<
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

export function DispatchStatusBadge({ status }: { status: DispatchStatus }) {
  const meta = DISPATCH_STATUS_META[status]
  return (
    <Badge variant="outline" className={`px-2 py-0.5 ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}
