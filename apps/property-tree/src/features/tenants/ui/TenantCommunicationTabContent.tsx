import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Inbox,
  Info,
  Mail,
  MessageSquare,
  Search,
} from 'lucide-react'

import { useTenantCommunication } from '@/entities/tenant'

import type { CustomerMessage } from '@/services/api/core/communicationService'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/Collapsible'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Input } from '@/shared/ui/Input'
import { TabLayout } from '@/shared/ui/layout/TabLayout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

type Channel = CustomerMessage['dispatch']['channel']
type ChannelFilter = Channel | 'all'
type Status = CustomerMessage['recipient']['status']

const formatTimestamp = (iso: string): string =>
  new Date(iso).toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const channelLabel = (channel: Channel) =>
  channel === 'sms' ? 'SMS' : 'E-post'

function ChannelBadge({ channel }: { channel: Channel }) {
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

const STATUS_META: Record<Status, { label: string; className: string }> = {
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
  failed: {
    label: 'Misslyckades',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  bounced: {
    label: 'Studsade',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
}

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status]
  return (
    <Badge variant="outline" className={`px-2 py-0.5 ${meta.className}`}>
      {meta.label}
    </Badge>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="text-muted-foreground whitespace-nowrap">{label}:</span>
      <span className="text-foreground break-words">{value}</span>
    </div>
  )
}

function MessageRow({ message }: { message: CustomerMessage }) {
  const [isOpen, setIsOpen] = useState(false)
  const { dispatch, recipient } = message
  const title = dispatch.subject ?? channelLabel(dispatch.channel)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="transition-all duration-200 hover:shadow-sm">
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <ChannelBadge channel={dispatch.channel} />
                  <h3 className="font-medium text-foreground">{title}</h3>
                  <StatusBadge status={recipient.status} />
                </div>
                <p className="text-sm text-muted-foreground break-words line-clamp-2">
                  till {recipient.toAddress} — {dispatch.body}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground shrink-0">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{formatTimestamp(dispatch.triggeredAt)}</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <div className="pl-4 border-l-2 border-muted">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Detaljer
              </h4>
              <p className="text-sm text-foreground mb-3 whitespace-pre-wrap break-words">
                {dispatch.body}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                <DetailRow label="Mottagare" value={recipient.toAddress} />
                <DetailRow
                  label="Status"
                  value={STATUS_META[recipient.status].label}
                />
                <DetailRow
                  label="Kanal"
                  value={channelLabel(dispatch.channel)}
                />
                {dispatch.subject && (
                  <DetailRow label="Ämne" value={dispatch.subject} />
                )}
                {dispatch.triggeredByUser && (
                  <DetailRow
                    label="Skickat av"
                    value={dispatch.triggeredByUser}
                  />
                )}
                <DetailRow label="System" value={dispatch.provider} />
                {recipient.error && (
                  <DetailRow label="Fel" value={recipient.error} />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

interface TenantCommunicationTabContentProps {
  contactCode: string
}

export function TenantCommunicationTabContent({
  contactCode,
}: TenantCommunicationTabContentProps) {
  const { data, isLoading, error } = useTenantCommunication(contactCode)
  const [searchQuery, setSearchQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')

  const allMessages = useMemo(() => data ?? [], [data])

  const filteredMessages = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return allMessages.filter(({ dispatch, recipient }) => {
      const matchesChannel =
        channelFilter === 'all' || dispatch.channel === channelFilter
      const matchesSearch =
        query === '' ||
        dispatch.subject?.toLowerCase().includes(query) ||
        dispatch.body.toLowerCase().includes(query) ||
        recipient.toAddress.toLowerCase().includes(query)
      return matchesChannel && matchesSearch
    })
  }, [allMessages, searchQuery, channelFilter])

  return (
    <TabLayout
      title="Kommunikationslogg"
      showCard={false}
      isLoading={isLoading}
      error={error as Error | null}
      errorMessage="Kunde inte ladda kommunikationsloggen"
    >
      <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
        <Info className="h-4 w-4 shrink-0" />
        För tillfället syns endast meddelanden skickade manuellt från ONECore i
        kommunikationsloggen.
      </p>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök i meddelanden..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={channelFilter}
              onValueChange={(value) =>
                setChannelFilter(value as ChannelFilter)
              }
            >
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrera kanal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla kanaler</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">E-post</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {allMessages.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Visar {filteredMessages.length} av {allMessages.length}{' '}
              meddelanden
            </p>
          )}
        </CardContent>
      </Card>

      {allMessages.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Inga meddelanden"
          description="Inga meddelanden har skickats till denna kund ännu."
        />
      ) : filteredMessages.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              Inga meddelanden matchar de valda filtren.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredMessages.map((message) => (
            <MessageRow key={message.recipient.id} message={message} />
          ))}
        </div>
      )}
    </TabLayout>
  )
}
