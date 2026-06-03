import React, { useState, type ReactNode } from 'react'
import {
  TableCell,
  TableHead,
  TableRow,
  TableLink,
  TableExternalLink,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { ExpandButton } from './ExpandButton'
import {
  KeyTypeBadge,
  ItemTypeBadge,
  KeyEventBadge,
  ItemDisposedBadge,
  getLatestActiveEvent,
} from './StatusBadges'
import type { Card, KeyDetails } from '@/services/types'
import { extractCardOwnerId, getCardOwnerLink } from '@/utils/externalLinks'

/** Row-level context handed to a card cell (only the name column uses it). */
export interface CardCellContext {
  expanded: boolean
  toggleExpanded: () => void
}

/** One column, rendered for both key rows and card rows from the same width/header. */
export interface ItemColumn {
  header: string
  /** Tailwind width class, e.g. 'w-[12%]'. */
  width: string
  key: (key: KeyDetails) => ReactNode
  card: (card: Card, ctx: CardCellContext) => ReactNode
}

export interface LoanableItemColumnsConfig {
  /** Tailwind width for the leading selection checkbox cell, e.g. 'w-[40px]'. */
  checkboxWidth: string
  /** Render the leading selection checkbox. Default: true. */
  selectable?: boolean
  /** Columns in display order. The checkbox is rendered first automatically. */
  columns: ItemColumn[]
}

interface HeaderState {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean) => void
}

interface RowState {
  isSelected: boolean
  onToggleSelect: () => void
  /** Indent the first cell when nested under a group. */
  indent: boolean
}

function getKeyDetailUrl(key: KeyDetails): string {
  const params = new URLSearchParams({
    disposed: key.disposed ? 'true' : 'false',
    editKeyId: key.id,
  })
  if (key.rentalObjectCode) {
    params.set('rentalObjectCode', key.rentalObjectCode)
  }
  return `/Keys?${params.toString()}`
}

// ============================================
// Reusable column definitions
// ============================================

/** Name column: a key links to its detail page; a card links to its owner and
 *  exposes the code expander. */
export function nameColumn({
  width,
  label = 'Namn',
}: {
  width: string
  label?: string
}): ItemColumn {
  return {
    header: label,
    width,
    key: (key) => (
      <TableLink to={getKeyDetailUrl(key)}>{key.keyName}</TableLink>
    ),
    card: (card, { expanded, toggleExpanded }) => {
      const hasCodes = !!card.codes && card.codes.length > 0
      const ownerId = extractCardOwnerId(card.owner)
      const ownerLink = ownerId ? getCardOwnerLink(ownerId) : null
      return (
        <div className="flex items-center gap-2">
          {hasCodes && (
            <ExpandButton isExpanded={expanded} onClick={toggleExpanded} />
          )}
          <TableExternalLink
            href={ownerLink}
            onClick={(e) => e.stopPropagation()}
          >
            {card.name || card.cardId}
          </TableExternalLink>
        </div>
      )
    },
  }
}

export function seqColumn({ width }: { width: string }): ItemColumn {
  return {
    header: 'Löpnr',
    width,
    key: (key) => key.keySequenceNumber ?? '-',
    card: () => '-',
  }
}

export function flexColumn({ width }: { width: string }): ItemColumn {
  return {
    header: 'Flex',
    width,
    key: (key) => key.flexNumber ?? '-',
    card: () => '-',
  }
}

/** Lock-system column. `label` defaults to the key's own system code; override
 *  it when a fallback source is needed (e.g. a loan key-system map). */
export function systemColumn({
  width,
  label = (key) => key.keySystem?.systemCode || '-',
}: {
  width: string
  label?: (key: KeyDetails) => string
}): ItemColumn {
  return {
    header: 'Låssystem',
    width,
    key: (key) => label(key),
    card: () => '-',
  }
}

export function typeColumn({ width }: { width: string }): ItemColumn {
  return {
    header: 'Typ',
    width,
    key: (key) => <KeyTypeBadge keyType={key.keyType} />,
    card: () => <ItemTypeBadge itemType="CARD" />,
  }
}

/** Status column (active key event) — shared by the item tables. */
export const statusColumn: ItemColumn = {
  header: 'Status',
  width: 'w-[12%]',
  key: (key) =>
    getLatestActiveEvent(key) ? (
      <KeyEventBadge event={getLatestActiveEvent(key)} />
    ) : (
      '-'
    ),
  card: () => '-',
}

/** Kassering column (disposed/disabled) — shared by the item tables. */
export const disposedColumn: ItemColumn = {
  header: 'Kassering',
  width: 'w-[10%]',
  key: (key) => <ItemDisposedBadge isDisposed={!!key.disposed} />,
  card: (card) => (
    <ItemDisposedBadge
      isDisposed={!!card.disabled}
      isCard
      isArchived={card.state === 'Archived'}
    />
  ),
}

// ============================================
// Table builder
// ============================================

/**
 * One source of truth for the key/card item tables. The caller supplies the
 * columns in display order; the selection checkbox is rendered first
 * automatically. Returns matching `header`, `keyRow`, and `cardRow` renderers
 * (plus `columnCount`) so headers, key rows, and card rows can't drift.
 *
 * The group indent always lands on the first visible cell — the checkbox when
 * selectable, otherwise the first column — so keys and cards indent identically.
 */
export function loanableItemColumns({
  checkboxWidth,
  selectable = true,
  columns,
}: LoanableItemColumnsConfig) {
  const columnCount = (selectable ? 1 : 0) + columns.length

  const firstColIndent = (index: number, indent: boolean) =>
    !selectable && indent && index === 0 ? 'pl-8' : ''

  return {
    columnCount,

    header({ checked, onCheckedChange }: HeaderState): ReactNode {
      return (
        <TableRow className="bg-background">
          {selectable && (
            <TableHead className={`${checkboxWidth} pl-8`}>
              <Checkbox
                checked={checked}
                onCheckedChange={onCheckedChange}
                aria-label="Markera alla"
              />
            </TableHead>
          )}
          {columns.map((col) => (
            <TableHead key={col.header} className={col.width}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      )
    },

    keyRow(
      key: KeyDetails,
      { isSelected, onToggleSelect, indent }: RowState
    ): ReactNode {
      return (
        <TableRow key={key.id} className="bg-background h-12">
          {selectable && (
            <TableCell className={`${checkboxWidth} ${indent ? 'pl-8' : ''}`}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                aria-label={`Markera ${key.keyName}`}
              />
            </TableCell>
          )}
          {columns.map((col, i) => (
            <TableCell
              key={col.header}
              className={`${col.width} ${firstColIndent(i, indent)}`}
            >
              {col.key(key)}
            </TableCell>
          ))}
        </TableRow>
      )
    },

    cardRow(card: Card, state: RowState): ReactNode {
      return (
        <CardRow
          key={card.cardId}
          card={card}
          columns={columns}
          checkboxWidth={checkboxWidth}
          selectable={selectable}
          columnCount={columnCount}
          {...state}
        />
      )
    },
  }
}

interface CardRowProps extends RowState {
  card: Card
  columns: ItemColumn[]
  checkboxWidth: string
  selectable: boolean
  columnCount: number
}

/**
 * A card row, assembled from each column's `card` renderer, with expandable code
 * sub-rows. Owns the expand state and hands it to the columns via CardCellContext.
 * Internal — use `loanableItemColumns(...).cardRow`.
 */
function CardRow({
  card,
  columns,
  checkboxWidth,
  selectable,
  isSelected,
  onToggleSelect,
  indent,
  columnCount,
}: CardRowProps) {
  const [expanded, setExpanded] = useState(false)
  const ctx: CardCellContext = {
    expanded,
    toggleExpanded: () => setExpanded((v) => !v),
  }
  const hasCodes = !!card.codes && card.codes.length > 0

  return (
    <React.Fragment>
      <TableRow className="bg-background h-12">
        {selectable && (
          <TableCell className={`${checkboxWidth} ${indent ? 'pl-8' : ''}`}>
            <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
          </TableCell>
        )}
        {columns.map((col, i) => (
          <TableCell
            key={col.header}
            className={`${col.width} ${
              !selectable && indent && i === 0 ? 'pl-8' : ''
            }`}
          >
            {col.card(card, ctx)}
          </TableCell>
        ))}
      </TableRow>
      {expanded &&
        hasCodes &&
        card.codes!.map((code: { format?: string; number?: string }, idx) => (
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
        ))}
    </React.Fragment>
  )
}
