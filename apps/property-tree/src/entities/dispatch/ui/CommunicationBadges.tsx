import { Home, Mail, MessageSquare } from 'lucide-react'

import type {
  DispatchListItem,
  MessageRecipient,
} from '@/services/api/core/communicationService'

import { Badge } from '@/shared/ui/Badge'

import {
  CHANNEL_META,
  channelLabel,
  DISPATCH_STATUS_META,
  RECIPIENT_STATUS_META,
} from './communicationLabels'

type Channel = DispatchListItem['channel']
type DispatchStatus = DispatchListItem['status']
type RecipientStatus = MessageRecipient['status']

const CHANNEL_ICON: Record<Channel, typeof MessageSquare> = {
  sms: MessageSquare,
  email: Mail,
  'my-pages': Home,
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  const Icon = CHANNEL_ICON[channel]
  return (
    <Badge
      variant="outline"
      className={`gap-1 px-2 py-0.5 ${CHANNEL_META[channel].className}`}
    >
      <Icon className="h-3 w-3" />
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
