import { useState } from 'react'
import {
  TableCell,
  TableCellMuted,
  TableHead,
  TableRow,
  TableLink,
  TableExternalLink,
} from '@/components/ui/table'
import { ExpandButton } from '@/components/shared/tables/ExpandButton'
import {
  ItemTypeBadge,
  ItemDisposedBadge,
  KeyEventBadge,
  getLatestActiveEvent,
} from '@/components/shared/tables/StatusBadges'
import { extractCardOwnerId, getCardOwnerLink } from '@/utils/externalLinks'
import type { KeyLoanWithDetails, CardDetails } from '@/services/types'

// Card type from loan's keyCardsArray
type LoanCard = NonNullable<KeyLoanWithDetails['keyCardsArray']>[number]

interface LoanItemsTableProps {
  loan: KeyLoanWithDetails
  keySystemMap: Record<string, string>
  cardDetailsMap?: Record<string, CardDetails>
  /** Number of columns in parent table, for alignment */
  columnCount: number
  /** Optional className for the header row (e.g. subtable background styling) */
  headerClassName?: string
}

/**
 * Renders keys and cards for an expanded loan row.
 * Returns multiple <TableRow> elements - NOT wrapped in a single cell.
 * This ensures each row is individually hoverable.
 */
export function LoanItemsTable({
  loan,
  keySystemMap,
  cardDetailsMap = {},
  columnCount,
  headerClassName,
}: LoanItemsTableProps) {
  const keys = loan.keysArray || []
  const cards = loan.keyCardsArray || []
  const hasItems = keys.length > 0 || cards.length > 0

  const getKeyUrl = (
    keyId: string,
    rentalObjectCode?: string,
    disposed?: boolean
  ) => {
    const params = new URLSearchParams({
      disposed: disposed ? 'true' : 'false',
      editKeyId: keyId,
    })
    if (rentalObjectCode) {
      params.set('rentalObjectCode', rentalObjectCode)
    }
    return `/Keys?${params.toString()}`
  }

  if (!hasItems) {
    return (
      <TableRow className="bg-muted/20">
        <TableCell
          colSpan={columnCount}
          className="text-center py-4 text-muted-foreground pl-12"
        >
          Inga nycklar eller droppar i detta lån
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      {/* Subtable header */}
      <TableRow className={headerClassName}>
        <TableHead className="w-[50px]" />
        <TableHead>Namn</TableHead>
        <TableHead>Löpnr</TableHead>
        <TableHead>Flex</TableHead>
        <TableHead>Låssystem</TableHead>
        <TableHead>Hyresobjekt</TableHead>
        <TableHead>Typ</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Kassering</TableHead>
        <TableHead className="w-[50px]" />
      </TableRow>

      {/* Key rows */}
      {keys.map((key) => {
        const latestEvent = getLatestActiveEvent(key)
        return (
          <TableRow key={key.id}>
            <TableCell className="w-[50px]" />
            <TableCell>
              <TableLink
                to={getKeyUrl(key.id, key.rentalObjectCode, key.disposed)}
              >
                {key.keyName}
              </TableLink>
            </TableCell>
            <TableCellMuted>{key.keySequenceNumber ?? '-'}</TableCellMuted>
            <TableCellMuted>{key.flexNumber ?? '-'}</TableCellMuted>
            <TableCellMuted>
              {key.keySystemId ? keySystemMap[key.keySystemId] || '-' : '-'}
            </TableCellMuted>
            <TableCellMuted>{key.rentalObjectCode || '-'}</TableCellMuted>
            <TableCell>
              <ItemTypeBadge itemType={key.keyType} />
            </TableCell>
            <TableCell>
              {latestEvent ? (
                <KeyEventBadge event={latestEvent} />
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              <ItemDisposedBadge isDisposed={key.disposed ?? false} />
            </TableCell>
            <TableCell className="w-[50px]" />
          </TableRow>
        )
      })}

      {/* Card rows */}
      {cards.map((card) => (
        <CardRow
          key={card.cardId}
          card={card}
          fullCardDetails={cardDetailsMap[card.cardId]}
          columnCount={columnCount}
        />
      ))}
    </>
  )
}

function CardRow({
  card,
  fullCardDetails,
  columnCount,
}: {
  card: LoanCard
  fullCardDetails?: CardDetails
  columnCount: number
}) {
  const [expanded, setExpanded] = useState(false)
  // Use full card details if available, fallback to loan card data
  const cardData = fullCardDetails || card
  const hasCodes = cardData.codes && cardData.codes.length > 0
  const ownerId = extractCardOwnerId(cardData.owner)
  const ownerLink = ownerId ? getCardOwnerLink(ownerId) : null

  return (
    <>
      <TableRow>
        <TableCell className="w-[50px]" />
        <TableCell>
          <div className="flex items-center gap-2">
            {hasCodes && (
              <ExpandButton
                isExpanded={expanded}
                onClick={() => setExpanded(!expanded)}
              />
            )}
            <TableExternalLink
              href={ownerLink}
              onClick={(e) => e.stopPropagation()}
            >
              {card.name || card.cardId}
            </TableExternalLink>
          </div>
        </TableCell>
        <TableCellMuted>-</TableCellMuted>
        <TableCellMuted>-</TableCellMuted>
        <TableCellMuted>-</TableCellMuted>
        <TableCellMuted>-</TableCellMuted>
        <TableCell>
          <ItemTypeBadge itemType="CARD" />
        </TableCell>
        <TableCell>
          <span className="text-muted-foreground">-</span>
        </TableCell>
        <TableCell>
          <ItemDisposedBadge isDisposed={card.disabled ?? false} isCard />
        </TableCell>
        <TableCell className="w-[50px]" />
      </TableRow>
      {expanded &&
        hasCodes &&
        cardData.codes!.map(
          (code: { format?: string; number?: string }, idx) => (
            <TableRow key={idx} className="bg-muted/30">
              <TableCell colSpan={columnCount} className="py-2 pl-16 text-sm">
                <span className="font-mono text-xs text-muted-foreground mr-4">
                  {code.format || '-'}
                </span>
                <span className="font-mono font-medium">
                  {code.number || JSON.stringify(code)}
                </span>
              </TableCell>
            </TableRow>
          )
        )}
    </>
  )
}
