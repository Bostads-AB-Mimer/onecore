import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Inbox,
  Mail,
  MessageSquare,
  Search,
} from 'lucide-react'

import { useTenantCommunication } from '@/entities/tenant'

import type { CustomerMessage } from '@/services/api/core/communicationService'

import { useToast } from '@/shared/hooks/useToast'
import {
  formatScheduleTimestamp,
  getScheduleBounds,
  MAX_SCHEDULE_DAYS_AHEAD,
  scheduleSendErrorText,
  toDatetimeLocalValue,
  validateScheduleInput,
} from '@/shared/lib/schedule'
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

// Maps schedule-management error codes forwarded by core (409 'conflict',
// 404 'not-found', and upstream 400 codes) to user-facing Swedish.
const scheduleErrorMessage = (error: unknown): string => {
  const code =
    error && typeof error === 'object'
      ? (error as { error?: string }).error
      : undefined
  return scheduleSendErrorText(code) ?? 'Ett fel uppstod.'
}

interface MessageRowProps {
  message: CustomerMessage
  onCancelSchedule: (dispatchId: string) => Promise<void>
  onReschedule: (dispatchId: string, sendAt: string) => Promise<void>
  isCancelling: boolean
  isRescheduling: boolean
}

function MessageRow({
  message,
  onCancelSchedule,
  onReschedule,
  isCancelling,
  isRescheduling,
}: MessageRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { dispatch, recipient } = message
  const title = dispatch.subject ?? channelLabel(dispatch.channel)

  const isScheduled =
    recipient.status === 'scheduled' &&
    new Date(dispatch.sendAt).getTime() > Date.now()
  // Email only for now: the Tele2 account's API key lacks bulk-management
  // permissions, so SMS cancel/reschedule 403s at Infobip.
  // TODO(MIM-1897): when Tele2 grants the permissions, drop the channel check:
  // const canManageSchedule = isScheduled
  const canManageSchedule = isScheduled && dispatch.channel === 'email'

  const [rescheduleLocal, setRescheduleLocal] = useState(() =>
    toDatetimeLocalValue(new Date(dispatch.sendAt))
  )
  const [confirmCancel, setConfirmCancel] = useState(false)
  const rescheduleError = validateScheduleInput(
    rescheduleLocal,
    MAX_SCHEDULE_DAYS_AHEAD[dispatch.channel]
  )
  const rescheduleBounds = getScheduleBounds(
    MAX_SCHEDULE_DAYS_AHEAD[dispatch.channel]
  )

  const handleRescheduleClick = async () => {
    if (rescheduleError) return
    // datetime-local is parsed as local time; the API gets a UTC instant.
    await onReschedule(dispatch.id, new Date(rescheduleLocal).toISOString())
  }

  const handleCancelClick = async () => {
    // Two-click confirm: first click arms, second executes.
    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }
    setConfirmCancel(false)
    await onCancelSchedule(dispatch.id)
  }

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
                <span>{formatTimestamp(dispatch.sendAt)}</span>
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

              {canManageSchedule && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4" />
                    Hantera schemalagt utskick
                  </h4>
                  {dispatch.recipientCount > 1 && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span className="text-sm">
                        Utskicket har {dispatch.recipientCount} mottagare —
                        avbokning och ombokning gäller alla mottagare, inte bara
                        denna kund.
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="datetime-local"
                      value={rescheduleLocal}
                      onChange={(e) => setRescheduleLocal(e.target.value)}
                      min={rescheduleBounds.min}
                      max={rescheduleBounds.max}
                      className="w-auto"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRescheduleClick}
                      disabled={!!rescheduleError || isRescheduling}
                    >
                      {isRescheduling ? 'Bokar om...' : 'Boka om'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleCancelClick}
                      disabled={isCancelling}
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      {isCancelling
                        ? 'Avbokar...'
                        : confirmCancel
                          ? 'Bekräfta avbokning'
                          : 'Avboka utskick'}
                    </Button>
                  </div>
                  {rescheduleError && (
                    <p className="text-sm text-destructive">
                      {rescheduleError}
                    </p>
                  )}
                </div>
              )}
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
  const {
    data,
    isLoading,
    error,
    cancelDispatch,
    isCancelling,
    rescheduleDispatch,
    isRescheduling,
  } = useTenantCommunication(contactCode)
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')

  const handleCancelSchedule = async (dispatchId: string) => {
    try {
      await cancelDispatch(dispatchId)
      toast({ title: 'Utskicket avbokades' })
    } catch (err) {
      toast({
        title: 'Kunde inte avboka utskicket',
        description: scheduleErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

  const handleReschedule = async (dispatchId: string, sendAt: string) => {
    try {
      await rescheduleDispatch({ dispatchId, sendAt })
      toast({
        title: 'Utskicket ombokades',
        description: `Skickas ${formatScheduleTimestamp(sendAt)}`,
      })
    } catch (err) {
      toast({
        title: 'Kunde inte boka om utskicket',
        description: scheduleErrorMessage(err),
        variant: 'destructive',
      })
    }
  }

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
            <MessageRow
              key={message.recipient.id}
              message={message}
              onCancelSchedule={handleCancelSchedule}
              onReschedule={handleReschedule}
              isCancelling={isCancelling}
              isRescheduling={isRescheduling}
            />
          ))}
        </div>
      )}
    </TabLayout>
  )
}
