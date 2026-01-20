import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import type { KeyLoan, KeyDetails, CardDetails } from '@/services/types'
import {
  KeyTypeLabels,
  KeyEventTypeLabels,
  KeyEventStatusLabels,
  LoanTypeLabels,
  KeySystemTypeLabels,
  type KeyEventType,
  type KeyEventStatus,
  type LoanType,
  type KeySystemType,
} from '@/services/types'
import { getActiveLoan, getPreviousLoan } from '@/utils/loanHelpers'

// ============================================
// Loan Status Badge
// ============================================

export type LoanStatusType = 'returned' | 'active' | 'not-picked-up' | 'none'

export function getLoanStatusType(loan: KeyLoan | null): LoanStatusType {
  if (!loan) return 'none'
  if (loan.returnedAt) return 'returned'
  if (loan.pickedUpAt) return 'active'
  return 'not-picked-up'
}

interface LoanStatusBadgeProps {
  loan: KeyLoan | null
  showNone?: boolean
}

/**
 * Badge showing the status of a loan (Återlämnad, Aktiv, Ej upphämtad)
 */
export function LoanStatusBadge({ loan, showNone = false }: LoanStatusBadgeProps) {
  const status = getLoanStatusType(loan)

  switch (status) {
    case 'returned':
      return <Badge variant="secondary">Återlämnad</Badge>
    case 'active':
      return (
        <Badge variant="default" className="bg-green-600">
          Aktiv
        </Badge>
      )
    case 'not-picked-up':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Ej upphämtad
        </Badge>
      )
    case 'none':
      return showNone ? (
        <Badge variant="outline" className="text-muted-foreground">
          Inget lån
        </Badge>
      ) : null
  }
}

// ============================================
// Key Type Badge
// ============================================

function getKeyTypeVariant(
  keyType: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (keyType) {
    case 'LGH':
    case 'MV':
    case 'FÖR':
      return 'default'
    case 'PB':
    case 'GAR':
    case 'HL':
    case 'ÖVR':
      return 'secondary'
    case 'FS':
    case 'LOK':
    case 'SOP':
      return 'outline'
    case 'HN':
      return 'destructive'
    default:
      return 'default'
  }
}

interface KeyTypeBadgeProps {
  keyType: string
  /** Use variant based on key type. Default: false (uses secondary) */
  withVariant?: boolean
  className?: string
}

/** Badge showing the type of key (Lägenhetsnyckel, Passerbricksnyckel, etc.) */
export function KeyTypeBadge({
  keyType,
  withVariant = false,
  className,
}: KeyTypeBadgeProps) {
  const label = KeyTypeLabels[keyType as keyof typeof KeyTypeLabels] || keyType
  const variant = withVariant ? getKeyTypeVariant(keyType) : 'secondary'
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}

// ============================================
// Loan Type Badge
// ============================================

interface LoanTypeBadgeProps {
  loanType: LoanType
}

/** Badge showing the type of loan (Hyresgäst, Underhåll) */
export function LoanTypeBadge({ loanType }: LoanTypeBadgeProps) {
  return <Badge variant="outline">{LoanTypeLabels[loanType]}</Badge>
}

// ============================================
// Key Event Badge
// ============================================

interface KeyEvent {
  type: KeyEventType
  status: KeyEventStatus
}

/**
 * Get display label for a key event (combines type + status)
 */
export function getKeyEventDisplayLabel(event: KeyEvent): string {
  const typeLabel = KeyEventTypeLabels[event.type]
  const statusLabel = KeyEventStatusLabels[event.status]
  return `${typeLabel} ${statusLabel.toLowerCase()}`
}

/**
 * Check if a key event is still active (not completed)
 */
export function isActiveKeyEvent(event: KeyEvent): boolean {
  return event.status !== 'COMPLETED'
}

interface KeyEventBadgeProps {
  event: KeyEvent | null
  /** Only show badge if the event is active (not completed). Default: true */
  onlyActive?: boolean
}

/**
 * Badge showing the status of a key event (Flex beställd, Extranyckel inkommen, etc.)
 * By default only shows active (non-completed) events.
 */
export function KeyEventBadge({ event, onlyActive = true }: KeyEventBadgeProps) {
  if (!event) return null
  if (onlyActive && !isActiveKeyEvent(event)) return null

  return <Badge variant="outline">{getKeyEventDisplayLabel(event)}</Badge>
}

// ============================================
// Disposed Status Badge
// ============================================

interface DisposedBadgeProps {
  disposed: boolean
  /** Show the badge even when not disposed. Default: false */
  showActive?: boolean
}

/**
 * Badge showing if a key/card is disposed (Kasserad) or active
 */
export function DisposedBadge({ disposed, showActive = false }: DisposedBadgeProps) {
  if (disposed) {
    return <Badge variant="destructive">Kasserad</Badge>
  }
  if (showActive) {
    return <Badge variant="secondary">Aktiv</Badge>
  }
  return null
}

// ============================================
// Combined Key Status Badge
// ============================================

/**
 * Get the latest non-completed event from a key's events array
 */
export function getLatestActiveEvent(key: KeyDetails): KeyEvent | null {
  if (!key.events || key.events.length === 0) return null
  // Events are sorted by date descending, so first one is latest
  const latestEvent = key.events[0]
  if (latestEvent.status === 'COMPLETED') return null
  return latestEvent as KeyEvent
}

interface KeyStatusBadgeProps {
  /** The key to get status for */
  keyData: KeyDetails
  /** What to show: 'event' for key events, 'loan' for loan status, 'auto' to prefer event over loan */
  type?: 'event' | 'loan' | 'auto'
}

/**
 * Unified badge that shows the most relevant status for a key.
 * In 'auto' mode, shows key event status if there's an active event,
 * otherwise shows loan status.
 */
export function KeyStatusBadge({ keyData, type = 'auto' }: KeyStatusBadgeProps) {
  if (type === 'event') {
    const event = getLatestActiveEvent(keyData)
    return <KeyEventBadge event={event} />
  }

  if (type === 'loan') {
    const loan = getActiveLoan(keyData)
    return <LoanStatusBadge loan={loan} />
  }

  // Auto mode: prefer event over loan
  const event = getLatestActiveEvent(keyData)
  if (event) {
    return <KeyEventBadge event={event} />
  }

  const loan = getActiveLoan(keyData)
  return <LoanStatusBadge loan={loan} />
}

// ============================================
// Pickup Availability Badge
// ============================================

export type PickupAvailabilityType =
  | 'picked-up'
  | 'available'
  | 'available-from'
  | 'not-available-until'

export interface PickupAvailabilityStatus {
  type: PickupAvailabilityType
  label: string
  variant: 'default' | 'destructive' | 'secondary' | 'outline'
  date?: Date
}

/**
 * Get pickup availability status for a key or card.
 * Determines if the item can be handed out to the next tenant.
 * Works with both KeyDetails and CardDetails.
 */
export function getPickupAvailability(
  item: KeyDetails | CardDetails
): PickupAvailabilityStatus {
  const activeLoan = getActiveLoan(item)
  const previousLoan = getPreviousLoan(item)

  // Case 1: Current loan exists AND has pickedUpAt - already picked up
  if (activeLoan?.pickedUpAt) {
    return { type: 'picked-up', label: 'Utlämnad', variant: 'outline' }
  }

  // Case 2-4: No picked up loan (either no loan or loan without pickedUpAt)
  // Check previousLoan.availableToNextTenantFrom
  const availableFrom = previousLoan?.availableToNextTenantFrom

  if (!availableFrom) {
    // No previous loan or no restriction - item can be picked up
    return { type: 'available', label: 'Får utlämnas', variant: 'default' }
  }

  const availableDate = new Date(availableFrom)
  const now = new Date()

  // Format date: show year only if different from current year
  const currentYear = now.getFullYear()
  const availableYear = availableDate.getFullYear()
  const dateFormat = currentYear === availableYear ? 'd MMM' : 'd MMM yyyy'
  const formattedDate = format(availableDate, dateFormat, { locale: sv })

  if (availableDate > now) {
    // Future date - cannot be picked up yet
    return {
      type: 'not-available-until',
      label: `Får ej utlämnas till ${formattedDate}`,
      variant: 'destructive',
      date: availableDate,
    }
  } else {
    // Past date - can be picked up
    return {
      type: 'available-from',
      label: `Får utlämnas från ${formattedDate}`,
      variant: 'default',
      date: availableDate,
    }
  }
}

interface PickupAvailabilityBadgeProps {
  /** Key or card data */
  itemData: KeyDetails | CardDetails
}

/**
 * Badge showing if the key/card can be handed out (Får utlämnas / Får ej utlämnas)
 * Works with both KeyDetails and CardDetails.
 */
export function PickupAvailabilityBadge({ itemData }: PickupAvailabilityBadgeProps) {
  const status = getPickupAvailability(itemData)
  return <Badge variant={status.variant}>{status.label}</Badge>
}

// ============================================
// Item Type Badge (Key Type or Card)
// ============================================

interface ItemTypeBadgeProps {
  /** Key type code (e.g., 'HN', 'FS') or 'CARD' for cards */
  itemType: string
}

/**
 * Badge showing the type of key or card.
 * For keys: Shows the key type label (Huvudnyckel, Fastighet, etc.)
 * For cards: Shows "Droppe"
 */
export function ItemTypeBadge({ itemType }: ItemTypeBadgeProps) {
  if (itemType === 'CARD') {
    return <Badge variant="secondary">Droppe</Badge>
  }
  const label = KeyTypeLabels[itemType as keyof typeof KeyTypeLabels] || itemType
  return <Badge variant="secondary">{label}</Badge>
}

// ============================================
// Item Disposed/Status Badge
// ============================================

interface ItemDisposedBadgeProps {
  /** For keys: disposed property. For cards: disabled property */
  isDisposed: boolean
  /** Whether this is a card (affects label text) */
  isCard?: boolean
}

/**
 * Badge showing if a key is kasserad or a card is inaktiv/aktiv.
 * Always shows the status (unlike DisposedBadge which can hide active state).
 */
export function ItemDisposedBadge({
  isDisposed,
  isCard = false,
}: ItemDisposedBadgeProps) {
  if (isDisposed) {
    return (
      <Badge variant="destructive">{isCard ? 'Inaktiv' : 'Kasserad'}</Badge>
    )
  }
  return <Badge variant="outline">Aktiv</Badge>
}

// ============================================
// Card Status Badge
// ============================================

interface CardStatusBadgeProps {
  disabled: boolean
}

/**
 * Badge showing if a card is active or inactive (disabled)
 */
export function CardStatusBadge({ disabled }: CardStatusBadgeProps) {
  if (disabled) {
    return <Badge variant="destructive">Inaktiv</Badge>
  }
  return <Badge variant="secondary">Aktiv</Badge>
}

// ============================================
// Key System Type Badge
// ============================================

function getKeySystemTypeVariant(
  type: KeySystemType
): 'default' | 'secondary' | 'outline' {
  switch (type) {
    case 'ELECTRONIC':
      return 'default'
    case 'MECHANICAL':
      return 'secondary'
    case 'HYBRID':
      return 'outline'
    default:
      return 'secondary'
  }
}

interface KeySystemTypeBadgeProps {
  type: KeySystemType
}

/**
 * Badge showing the type of key system (Mekaniskt, Elektroniskt, Hybrid)
 */
export function KeySystemTypeBadge({ type }: KeySystemTypeBadgeProps) {
  const label = KeySystemTypeLabels[type] || type
  const variant = getKeySystemTypeVariant(type)
  return <Badge variant={variant}>{label}</Badge>
}
