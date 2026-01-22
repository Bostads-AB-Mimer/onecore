import React, { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { KeyLoan, CardDetails } from '@/services/types'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { getActiveLoan, getPreviousLoan } from '@/utils/loanHelpers'
import { extractCardOwnerId, getCardOwnerLink } from '@/utils/externalLinks'

/**
 * Helper function to compute pickup availability status for a card
 */
function getPickupAvailability(card: CardDetails): {
  label: string
  variant: 'default' | 'destructive' | 'secondary' | 'outline'
} {
  const activeLoan = getActiveLoan(card)
  const previousLoan = getPreviousLoan(card)

  // Case 1: Current loan exists AND has pickedUpAt
  if (activeLoan?.pickedUpAt) {
    return { label: 'Utlämnad', variant: 'outline' }
  }

  // Case 2-4: No picked up loan (either no loan or loan without pickedUpAt)
  // Check previousLoan.availableToNextTenantFrom
  const availableFrom = previousLoan?.availableToNextTenantFrom

  if (!availableFrom) {
    // No previous loan or no restriction - card can be picked up
    return { label: 'Får utlämnas', variant: 'default' }
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
      label: `Får ej utlämnas till ${formattedDate}`,
      variant: 'destructive',
    }
  } else {
    // Past date - can be picked up
    return { label: `Får utlämnas från ${formattedDate}`, variant: 'default' }
  }
}

export interface LoanableCardTableConfig {
  // Column visibility
  columns?: {
    cardName?: boolean
    status?: boolean
    pickupAvailability?: boolean
    disposal?: boolean
  }
  // Header configuration
  showContactHeaders?: boolean
  showLoanHeaders?: boolean
  customLoanHeaderRenderer?: (
    loan: KeyLoan,
    cards: CardDetails[]
  ) => React.ReactNode
  // Selection
  selectable?: boolean
}

interface LoanableCardTableBaseProps {
  cards: CardDetails[]
  companyNames?: Record<string, string>
  config?: LoanableCardTableConfig
  selectedCards?: string[]
  onCardSelectionChange?: (cardId: string, checked: boolean) => void
}

/**
 * Base component for displaying loanable cards in a table with collapsible sections.
 * Similar to LoanableKeyTableBase but for cards (no navigation on click).
 */
export function LoanableCardTableBase({
  cards,
  companyNames = {},
  config = {},
  selectedCards = [],
  onCardSelectionChange,
}: LoanableCardTableBaseProps) {
  const {
    columns = {
      cardName: true,
      status: true,
      pickupAvailability: false,
      disposal: true,
    },
    showContactHeaders = true,
    showLoanHeaders = true,
    customLoanHeaderRenderer,
    selectable = false,
  } = config

  // Group cards internally by loan
  const grouped = useMemo(() => {
    const loanedCards = cards.filter((c) => getActiveLoan(c) !== null)
    const unloanedCards = cards.filter((c) => getActiveLoan(c) === null)

    // Group loaned cards by loan ID
    const byLoanId = loanedCards.reduce(
      (acc, card) => {
        const activeLoan = getActiveLoan(card)
        if (!activeLoan) return acc
        const loanId = activeLoan.id
        if (!acc[loanId]) {
          acc[loanId] = []
        }
        acc[loanId].push(card)
        return acc
      },
      {} as Record<string, CardDetails[]>
    )

    // Create loan groups with sorted cards
    const loans = Object.entries(byLoanId).map(([loanId, loanCards]) => {
      const activeLoan = getActiveLoan(loanCards[0])!
      return {
        loanId,
        loan: activeLoan,
        cards: sortCardsByName(loanCards),
      }
    })

    // Sort loans by creation date (newest first)
    loans.sort((a, b) => {
      const dateA = new Date(a.loan.createdAt).getTime()
      const dateB = new Date(b.loan.createdAt).getTime()
      return dateB - dateA
    })

    // Group by contact if needed
    const contactGroups: Array<{ contact: string; loans: typeof loans }> = []
    if (showContactHeaders) {
      const byContact = loans.reduce(
        (acc, loan) => {
          const contact = loan.loan.contact || 'unknown'
          if (!acc[contact]) {
            acc[contact] = []
          }
          acc[contact].push(loan)
          return acc
        },
        {} as Record<string, typeof loans>
      )

      for (const [contact, contactLoans] of Object.entries(byContact)) {
        contactGroups.push({ contact, loans: contactLoans })
      }
    } else {
      if (loans.length > 0) {
        contactGroups.push({ contact: 'all-loans', loans })
      }
    }

    // Group unloaned cards by previousLoan ID
    const unloanedByPreviousLoan = unloanedCards.reduce(
      (acc, card) => {
        const previousLoan = getPreviousLoan(card)
        const prevLoanId = previousLoan?.id || 'never-loaned'
        if (!acc[prevLoanId]) {
          acc[prevLoanId] = []
        }
        acc[prevLoanId].push(card)
        return acc
      },
      {} as Record<string, CardDetails[]>
    )

    // Create unloaned groups with sorted cards
    const unloanedGroups = Object.entries(unloanedByPreviousLoan).map(
      ([prevLoanId, groupCards]) => {
        const previousLoan = getPreviousLoan(groupCards[0])
        return {
          prevLoanId,
          previousLoan: previousLoan || null,
          cards: sortCardsByName(groupCards),
        }
      }
    )

    // Sort unloaned groups: cards that were never loaned first, then by most recent return date
    unloanedGroups.sort((a, b) => {
      if (a.prevLoanId === 'never-loaned') return -1
      if (b.prevLoanId === 'never-loaned') return 1

      const dateA = a.previousLoan?.returnedAt
        ? new Date(a.previousLoan.returnedAt).getTime()
        : 0
      const dateB = b.previousLoan?.returnedAt
        ? new Date(b.previousLoan.returnedAt).getTime()
        : 0
      return dateB - dateA // Most recently returned first
    })

    return {
      loaned: contactGroups,
      unloaned: unloanedGroups,
    }
  }, [cards, showContactHeaders])

  // State to track which contacts are expanded (default: all expanded)
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    new Set(grouped.loaned.map((cg) => cg.contact))
  )

  // State to track if unloaned section is expanded (default: expanded)
  const [unloanedExpanded, setUnloanedExpanded] = useState(true)

  const toggleCompany = (company: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(company)) {
        next.delete(company)
      } else {
        next.add(company)
      }
      return next
    })
  }

  // Calculate colspan based on visible columns
  const visibleColumnCount =
    Object.values(columns).filter(Boolean).length + (selectable ? 1 : 0)

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && <TableHead className="w-[50px]"></TableHead>}
            {columns.cardName && (
              <TableHead className="w-[30%]">Kortnamn</TableHead>
            )}
            {columns.status && (
              <TableHead className="w-[25%]">Status</TableHead>
            )}
            {columns.pickupAvailability && (
              <TableHead className="w-[25%]">Utlämning</TableHead>
            )}
            {columns.disposal && (
              <TableHead className="w-[20%]">Status</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Loaned cards grouped by contact then loan */}
          {grouped.loaned.map((contactGroup) => {
            const isExpanded = expandedCompanies.has(contactGroup.contact)
            return (
              <React.Fragment key={`contact-${contactGroup.contact}`}>
                {/* Contact header row - only show if enabled */}
                {showContactHeaders && (
                  <TableRow
                    className="bg-muted hover:bg-muted/80 cursor-pointer"
                    onClick={() => toggleCompany(contactGroup.contact)}
                  >
                    <TableCell
                      colSpan={visibleColumnCount}
                      className="font-semibold py-4"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {companyNames[contactGroup.contact] ||
                          contactGroup.contact}
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* Loans within this contact - only show if expanded (or if no contact headers) */}
                {(isExpanded || !showContactHeaders) &&
                  contactGroup.loans.map((loan: any) => (
                    <React.Fragment key={`loan-${loan.loanId}`}>
                      {/* Loan header row - only show if enabled */}
                      {showLoanHeaders && (
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell
                            colSpan={visibleColumnCount}
                            className="font-medium text-sm pl-8"
                          >
                            {customLoanHeaderRenderer ? (
                              customLoanHeaderRenderer(loan.loan, loan.cards)
                            ) : (
                              <DefaultLoanHeader loan={loan.loan} />
                            )}
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Card data rows for this loan */}
                      {loan.cards.map((card: CardDetails) => (
                        <CardRow
                          key={card.cardId}
                          cardData={card}
                          columns={columns}
                          indent={true}
                          selectable={selectable}
                          isSelected={selectedCards.includes(card.cardId)}
                          onSelectionChange={onCardSelectionChange}
                          visibleColumnCount={visibleColumnCount}
                        />
                      ))}
                    </React.Fragment>
                  ))}
              </React.Fragment>
            )
          })}

          {/* Unloaned cards section */}
          {grouped.unloaned.length > 0 && (
            <>
              {/* Unloaned header row - clickable to expand/collapse */}
              <TableRow
                className="bg-muted hover:bg-muted/80 cursor-pointer"
                onClick={() => setUnloanedExpanded(!unloanedExpanded)}
              >
                <TableCell
                  colSpan={visibleColumnCount}
                  className="font-semibold py-4"
                >
                  <div className="flex items-center gap-2">
                    {unloanedExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Ej utlånade
                  </div>
                </TableCell>
              </TableRow>

              {/* Unloaned groups - only show if expanded */}
              {unloanedExpanded &&
                grouped.unloaned.map((group) => (
                  <React.Fragment key={group.prevLoanId}>
                    {/* Previous loan header (if exists) */}
                    {group.previousLoan && (
                      <TableRow className="bg-muted/50">
                        <TableCell
                          colSpan={visibleColumnCount}
                          className="font-medium py-3 pl-6"
                        >
                          {customLoanHeaderRenderer ? (
                            customLoanHeaderRenderer(
                              group.previousLoan,
                              group.cards
                            )
                          ) : (
                            <DefaultLoanHeader loan={group.previousLoan} />
                          )}
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Card data rows for this unloaned group */}
                    {group.cards.map((card: CardDetails) => (
                      <CardRow
                        key={card.cardId}
                        cardData={card}
                        columns={columns}
                        indent={true}
                        selectable={selectable}
                        isSelected={selectedCards.includes(card.cardId)}
                        onSelectionChange={onCardSelectionChange}
                        visibleColumnCount={visibleColumnCount}
                      />
                    ))}
                  </React.Fragment>
                ))}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Default loan header renderer
 */
function DefaultLoanHeader({ loan }: { loan: KeyLoan }) {
  return (
    <div className="flex items-center gap-3">
      <Badge variant="outline">
        {loan.loanType === 'TENANT' ? 'Hyresgästlån' : 'Underhållslån'}
      </Badge>
      {loan.contact && (
        <span className="text-muted-foreground">Kontakt: {loan.contact}</span>
      )}
      {loan.contactPerson && (
        <span className="text-muted-foreground">
          Kontakt: {loan.contactPerson}
        </span>
      )}
      {loan.pickedUpAt ? (
        <span className="text-muted-foreground">
          Upphämtad:{' '}
          {format(new Date(loan.pickedUpAt), 'd MMM yyyy', { locale: sv })}
        </span>
      ) : loan.createdAt ? (
        <>
          <span className="text-muted-foreground">
            Utlånad:{' '}
            {format(new Date(loan.createdAt), 'd MMM yyyy', { locale: sv })}
          </span>
          <span className="text-muted-foreground font-semibold">
            Ej upphämtat
          </span>
        </>
      ) : null}
      {loan.returnedAt && (
        <span className="text-muted-foreground">
          Återlämnad:{' '}
          {format(new Date(loan.returnedAt), 'd MMM yyyy', { locale: sv })}
        </span>
      )}
    </div>
  )
}

/**
 * Individual card row component with expandable codes
 */
interface CardRowProps {
  cardData: CardDetails
  columns: LoanableCardTableConfig['columns']
  indent?: boolean
  selectable?: boolean
  isSelected?: boolean
  onSelectionChange?: (cardId: string, checked: boolean) => void
  visibleColumnCount: number
}

function CardRow({
  cardData,
  columns = {},
  indent = false,
  selectable = false,
  isSelected = false,
  onSelectionChange,
  visibleColumnCount,
}: CardRowProps) {
  const [expanded, setExpanded] = React.useState(false)
  const hasCodes = cardData.codes && cardData.codes.length > 0

  return (
    <>
      <TableRow
        className={hasCodes ? 'cursor-pointer hover:bg-muted/50' : ''}
        onClick={() => hasCodes && setExpanded(!expanded)}
      >
        {selectable && (
          <TableCell
            className={`w-[50px] ${indent ? 'pl-8' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) =>
                onSelectionChange?.(cardData.cardId, checked as boolean)
              }
            />
          </TableCell>
        )}
        {columns.cardName && (
          <TableCell
            className={`font-medium w-[30%] ${!selectable && indent ? 'pl-8' : ''}`}
          >
            <div className="flex items-center gap-2">
              {hasCodes &&
                (expanded ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                ))}
              {(() => {
                const ownerId = extractCardOwnerId(cardData.owner)
                const ownerLink = ownerId ? getCardOwnerLink(ownerId) : null
                const displayName = cardData.name || cardData.cardId

                return ownerLink ? (
                  <a
                    href={ownerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {displayName}
                  </a>
                ) : (
                  <span className="font-medium text-sm">{displayName}</span>
                )
              })()}
            </div>
          </TableCell>
        )}
        {columns.status && <TableCell className="w-[25%]">-</TableCell>}
        {columns.pickupAvailability && (
          <TableCell className="w-[25%]">
            {(() => {
              const status = getPickupAvailability(cardData)
              return <Badge variant={status.variant}>{status.label}</Badge>
            })()}
          </TableCell>
        )}
        {columns.disposal && (
          <TableCell className="w-[20%]">
            <Badge variant={cardData.disabled ? 'destructive' : 'outline'}>
              {cardData.disabled ? 'Inaktivt' : 'Aktivt'}
            </Badge>
          </TableCell>
        )}
      </TableRow>

      {/* Expanded codes rows */}
      {expanded && hasCodes && (
        <>
          {cardData.codes!.map((code: any, idx: number) => (
            <TableRow key={idx} className="bg-muted/30">
              <TableCell
                colSpan={visibleColumnCount}
                className="py-2 pl-16 text-sm"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-muted-foreground min-w-[100px]">
                    {code.format || '-'}
                  </span>
                  <span className="font-mono font-medium">
                    {code.number ||
                      (typeof code === 'string' ? code : JSON.stringify(code))}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </>
      )}
    </>
  )
}

/**
 * Sort cards by name
 */
function sortCardsByName(cards: CardDetails[]): CardDetails[] {
  return [...cards].sort((a, b) => {
    const nameA = a.name || a.cardId
    const nameB = b.name || b.cardId
    return nameA.localeCompare(nameB)
  })
}
