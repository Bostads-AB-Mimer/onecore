import { Mail, MessageSquare } from 'lucide-react'

import type {
  DispatchListItem,
  MessageRecipient,
} from '@/services/api/core/communicationService'

import { Badge } from '@/shared/ui/Badge'

import {
  channelLabel,
  DISPATCH_STATUS_META,
  RECIPIENT_STATUS_META,
} from './communicationLabels'

type Channel = DispatchListItem['channel']
type DispatchStatus = DispatchListItem['status']
type RecipientStatus = MessageRecipient['status']

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

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  const meta = RECIPIENT_STATUS_META[status]
  return (
    <Badge variant="outline" className={`px-2 py-0.5 ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

export function DispatchStatusBadge({ status }: { status: DispatchStatus }) {
  const meta = DISPATCH_STATUS_META[status]
  return (
    <Badge variant="outline" className={`px-2 py-0.5 ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}
