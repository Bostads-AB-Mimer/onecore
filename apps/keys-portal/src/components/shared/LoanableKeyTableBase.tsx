import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import {
  KeyDetails,
  KeyTypeLabels,
  getKeyEventDisplayLabel,
  KeyLoan,
  KeyEvent,
} from '@/services/types'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { getActiveLoan, getPreviousLoan } from '@/utils/loanHelpers'

/**
 * Helper to get the latest event from events array
 */
function getLatestEvent(key: KeyDetails): KeyEvent | null {
  if (!key.events || key.events.length === 0) return null
  return key.events[0] // Backend already returns sorted by createdAt desc
}

/**
 * Helper function to compute pickup availability status for a key
 */
function getPickupAvailability(key: KeyDetails): {
  label: string
  variant: 'default' | 'destructive' | 'secondary' | 'outline'
} {
  const activeLoan = getActiveLoan(key)
  const previousLoan = getPreviousLoan(key)

  // Case 1: Current loan exists AND has pickedUpAt
  if (activeLoan?.pickedUpAt) {
    return { label: 'Utlämnad', variant: 'outline' }
  }

  // Case 2-4: No picked up loan (either no loan or loan without pickedUpAt)
  // Check previousLoan.availableToNextTenantFrom
  const availableFrom = previousLoan?.availableToNextTenantFrom

  if (!availableFrom) {
    // No previous loan or no restriction - key can be picked up
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

export interface LoanableKeyTableConfig {
  // Column visibility
  columns?: {
    keyName?: boolean
    sequence?: boolean
    flex?: boolean
    keySystem?: boolean
    status?: boolean
    pickupAvailability?: boolean
    disposal?: boolean
    type?: boolean
    rentalObject?: boolean
  }
  // Header configuration
  showContactHeaders?: boolean
  showLoanHeaders?: boolean
  customLoanHeaderRenderer?: (
    loan: KeyLoan,
    keys: KeyDetails[]
  ) => React.ReactNode
  // Selection
  selectable?: boolean
}

interface LoanableKeyTableBaseProps {
  keys: KeyDetails[]
  companyNames?: Record<string, string>
  config?: LoanableKeyTableConfig
  selectedKeys?: string[]
  onKeySelectionChange?: (keyId: string, checked: boolean) => void
}

/**
 * Shared base component for displaying loanable keys in a table with collapsible sections.
 * Used by both KeyBundleKeysList and LeaseKeyTableList.
 */
export function LoanableKeyTableBase({
  keys,
  companyNames = {},
  config = {},
  selectedKeys = [],
  onKeySelectionChange,
}: LoanableKeyTableBaseProps) {

  const {
    columns = {
      keyName: true,
      sequence: true,
      flex: true,
      keySystem: true,
      status: true,
      pickupAvailability: false,
      type: true,
      rentalObject: true,
    },
    showContactHeaders = true,
    showLoanHeaders = true,
    customLoanHeaderRenderer,
    selectable = false,
  } = config

  // Group keys internally by loan
  const grouped = useMemo(() => {
    const loanedKeys = keys.filter((k) => getActiveLoan(k) !== null)
    const unloanedKeys = keys.filter((k) => getActiveLoan(k) === null)

    // Group loaned keys by loan ID
    const byLoanId = loanedKeys.reduce(
      (acc, key) => {
        const activeLoan = getActiveLoan(key)
        if (!activeLoan) return acc
        const loanId = activeLoan.id
        if (!acc[loanId]) {
          acc[loanId] = []
        }
        acc[loanId].push(key)
        return acc
      },
      {} as Record<string, KeyDetails[]>
    )

    // Create loan groups with sorted keys
    const loans = Object.entries(byLoanId).map(([loanId, loanKeys]) => {
      const activeLoan = getActiveLoan(loanKeys[0])!
      return {
        loanId,
        loan: activeLoan,
        keys: sortKeysByTypeAndName(loanKeys),
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

    // Group unloaned keys by previousLoan ID
    const unloanedByPreviousLoan = unloanedKeys.reduce(
      (acc, key) => {
        const previousLoan = getPreviousLoan(key)
        const prevLoanId = previousLoan?.id || 'never-loaned'
        if (!acc[prevLoanId]) {
          acc[prevLoanId] = []
        }
        acc[prevLoanId].push(key)
        return acc
      },
      {} as Record<string, KeyDetails[]>
    )

    // Create unloaned groups with sorted keys
    const unloanedGroups = Object.entries(unloanedByPreviousLoan).map(
      ([prevLoanId, groupKeys]) => {
        const previousLoan = getPreviousLoan(groupKeys[0])
        return {
          prevLoanId,
          previousLoan: previousLoan || null,
          keys: sortKeysByTypeAndName(groupKeys),
        }
      }
    )

    // Sort unloaned groups: keys that were never loaned first, then by most recent return date
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
  }, [keys, showContactHeaders])

  // State to track which contacts are expanded (default: all expanded)
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(
    new Set(grouped.loaned.map((cg) => cg.contact))
  )

  // Build URL for key details page
  const getKeyUrl = (key: KeyDetails) => {
    const disposed = key.disposed ? 'true' : 'false'
    const params = new URLSearchParams({
      disposed,
      editKeyId: key.id,
    })

    // Add rentalObjectCode if available
    if (key.rentalObjectCode) {
      params.set('rentalObjectCode', key.rentalObjectCode)
    }

    return `/Keys?${params.toString()}`
  }

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
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader className="bg-background">
          <TableRow className="bg-background">
            {selectable && <TableHead className="w-[50px]"></TableHead>}
            {columns.keyName && (
              <TableHead className="w-[22%]">Nyckelnamn</TableHead>
            )}
            {columns.sequence && (
              <TableHead className="w-[8%]">Löpnr</TableHead>
            )}
            {columns.flex && <TableHead className="w-[8%]">Flex</TableHead>}
            {columns.keySystem && (
              <TableHead className="w-[12%]">Låssystem</TableHead>
            )}
            {columns.type && <TableHead className="w-[15%]">Typ</TableHead>}
            {columns.status && (
              <TableHead className="w-[22%]">Status</TableHead>
            )}
            {columns.pickupAvailability && (
              <TableHead className="w-[22%]">Utlämning</TableHead>
            )}
            {columns.disposal && (
              <TableHead className="w-[15%]">Kassering</TableHead>
            )}
            {columns.rentalObject && (
              <TableHead className="w-[25%]">Hyresobjekt</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Loaned keys grouped by contact then loan */}
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
                              customLoanHeaderRenderer(loan.loan, loan.keys)
                            ) : (
                              <DefaultLoanHeader loan={loan.loan} />
                            )}
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Key data rows for this loan */}
                      {loan.keys.map((key: KeyDetails) => (
                        <KeyRow
                          key={key.id}
                          keyData={key}
                          columns={columns}
                          indent={true}
                          selectable={selectable}
                          isSelected={selectedKeys.includes(key.id)}
                          onSelectionChange={onKeySelectionChange}
                          keyUrl={getKeyUrl(key)}
                        />
                      ))}
                    </React.Fragment>
                  ))}
              </React.Fragment>
            )
          })}

          {/* Unloaned keys section */}
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
                              group.keys
                            )
                          ) : (
                            <DefaultLoanHeader loan={group.previousLoan} />
                          )}
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Key data rows for this unloaned group */}
                    {group.keys.map((key: KeyDetails) => (
                      <KeyRow
                        key={key.id}
                        keyData={key}
                        columns={columns}
                        indent={true}
                        selectable={selectable}
                        isSelected={selectedKeys.includes(key.id)}
                        onSelectionChange={onKeySelectionChange}
                        keyUrl={getKeyUrl(key)}
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
 * Individual key row component
 */
interface KeyRowProps {
  keyData: KeyDetails
  columns: LoanableKeyTableConfig['columns']
  indent?: boolean
  selectable?: boolean
  isSelected?: boolean
  onSelectionChange?: (keyId: string, checked: boolean) => void
  keyUrl?: string
}

function KeyRow({
  keyData,
  columns = {},
  indent = false,
  selectable = false,
  isSelected = false,
  onSelectionChange,
  keyUrl,
}: KeyRowProps) {
  return (
    <TableRow className="bg-background">
      {selectable && (
        <TableCell className={`w-[50px] ${indent ? 'pl-8' : ''}`}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) =>
              onSelectionChange?.(keyData.id, checked as boolean)
            }
          />
        </TableCell>
      )}
      {columns.keyName && (
        <TableCell
          className={`font-medium w-[22%] ${!selectable && indent ? 'pl-8' : ''}`}
        >
          {keyUrl ? (
            <Link
              to={keyUrl}
              className="font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {keyData.keyName}
            </Link>
          ) : (
            <span className="font-medium text-sm">{keyData.keyName}</span>
          )}
        </TableCell>
      )}
      {columns.sequence && (
        <TableCell className="w-[8%]">
          {keyData.keySequenceNumber ?? '-'}
        </TableCell>
      )}
      {columns.flex && (
        <TableCell className="w-[8%]">{keyData.flexNumber ?? '-'}</TableCell>
      )}
      {columns.keySystem && (
        <TableCell className="w-[12%]">
          {keyData.keySystem?.systemCode || '-'}
        </TableCell>
      )}
      {columns.type && (
        <TableCell className="w-[15%]">
          <Badge variant="secondary">
            {KeyTypeLabels[keyData.keyType as keyof typeof KeyTypeLabels]}
          </Badge>
        </TableCell>
      )}
      {columns.status && (
        <TableCell className="w-[22%]">
          {(() => {
            const latestEvent = getLatestEvent(keyData)
            return latestEvent && latestEvent.status !== 'COMPLETED' ? (
              <Badge variant="outline">
                {getKeyEventDisplayLabel(latestEvent)}
              </Badge>
            ) : (
              '-'
            )
          })()}
        </TableCell>
      )}
      {columns.pickupAvailability && (
        <TableCell className="w-[22%]">
          {(() => {
            const status = getPickupAvailability(keyData)
            return <Badge variant={status.variant}>{status.label}</Badge>
          })()}
        </TableCell>
      )}
      {columns.disposal && (
        <TableCell className="w-[15%]">
          <Badge variant={keyData.disposed ? 'destructive' : 'outline'}>
            {keyData.disposed ? 'Kasserad' : 'Aktiv'}
          </Badge>
        </TableCell>
      )}
      {columns.rentalObject && (
        <TableCell className="w-[25%]">
          {keyData.rentalObjectCode ?? '-'}
        </TableCell>
      )}
    </TableRow>
  )
}

/**
 * Sort keys by type, then name, then sequence
 */
function sortKeysByTypeAndName(keys: KeyDetails[]): KeyDetails[] {
  const KEY_TYPE_ORDER: Record<string, number> = {
    LGH: 1,
    PB: 2,
    FS: 3,
    HN: 4,
  }

  return [...keys].sort((a, b) => {
    // First by type
    const typeA = KEY_TYPE_ORDER[a.keyType] ?? 999
    const typeB = KEY_TYPE_ORDER[b.keyType] ?? 999
    if (typeA !== typeB) return typeA - typeB

    // Then by name
    const nameCmp = (a.keyName || '').localeCompare(b.keyName || '')
    if (nameCmp !== 0) return nameCmp

    // Then by sequence
    const seqA = a.keySequenceNumber ? Number(a.keySequenceNumber) : 999999
    const seqB = b.keySequenceNumber ? Number(b.keySequenceNumber) : 999999
    return seqA - seqB
  })
}
