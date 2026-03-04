import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import {
  TableCell,
  TableCellMuted,
  TableHead,
  TableRow,
  TableLink,
  TableExternalLink,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  CollapsibleGroupTable,
  type RowRenderProps,
} from '@/components/shared/tables/CollapsibleGroupTable'
import { LoanStatusBadge } from '@/components/shared/tables/StatusBadges'
import {
  ItemTypeBadge,
  ItemDisposedBadge,
  KeyEventBadge,
  getLatestActiveEvent,
} from '@/components/shared/tables/StatusBadges'
import { LoanActionMenu } from '@/components/loan/LoanActionMenu'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { extractCardOwnerId, getCardOwnerLink } from '@/utils/externalLinks'
import type { KeyLoanWithDetails, KeyDetails, Card } from '@/services/types'

const COLUMN_COUNT = 10

type MaintenanceLoanItem =
  | { itemType: 'key'; data: KeyDetails; parentLoan: KeyLoanWithDetails }
  | { itemType: 'card'; data: Card; parentLoan: KeyLoanWithDetails }

interface MaintenanceLoansTableProps {
  loans: KeyLoanWithDetails[]
  keySystemMap: Record<string, string>
  emptyMessage?: string
  onLoanReturned?: (loanId: string) => void
  onLoanUpdated?: (loanId: string) => void
}

export function MaintenanceLoansTable({
  loans,
  keySystemMap,
  emptyMessage = 'Inga lån',
  onLoanReturned,
  onLoanUpdated,
}: MaintenanceLoansTableProps) {
  const [contactData, setContactData] = useState<
    Record<
      string,
      {
        fullName: string
        contactCode: string
        nationalRegistrationNumber?: string
      }
    >
  >({})

  // Fetch contact names for all loans
  useEffect(() => {
    const fetchContactNames = async () => {
      const uniqueContactCodes = new Set<string>()

      loans.forEach((loan) => {
        if (loan.contact) uniqueContactCodes.add(loan.contact)
        if (loan.contact2) uniqueContactCodes.add(loan.contact2)
      })

      const data: typeof contactData = {}
      await Promise.all(
        Array.from(uniqueContactCodes).map(async (contactCode) => {
          try {
            const contact = await fetchContactByContactCode(contactCode)
            if (contact) {
              data[contactCode] = {
                fullName: contact.fullName ?? contactCode,
                contactCode,
                nationalRegistrationNumber:
                  contact.nationalRegistrationNumber || undefined,
              }
            }
          } catch (error) {
            console.error(`Failed to fetch contact ${contactCode}:`, error)
            data[contactCode] = { fullName: contactCode, contactCode }
          }
        })
      )

      setContactData(data)
    }

    if (loans.length > 0) {
      fetchContactNames()
    }
  }, [loans])

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    return format(new Date(date), 'd MMM yyyy', { locale: sv })
  }

  // Flatten loans into key/card items
  const items = useMemo<MaintenanceLoanItem[]>(() => {
    return loans.flatMap((loan) => [
      ...loan.keysArray.map(
        (key) =>
          ({
            itemType: 'key',
            data: key,
            parentLoan: loan,
          }) as MaintenanceLoanItem
      ),
      ...(loan.keyCardsArray || []).map(
        (card) =>
          ({
            itemType: 'card',
            data: card,
            parentLoan: loan,
          }) as MaintenanceLoanItem
      ),
    ])
  }, [loans])

  const getKeyUrl = (key: KeyDetails) => {
    const params = new URLSearchParams({
      disposed: key.disposed ? 'true' : 'false',
      editKeyId: key.id,
    })
    if (key.rentalObjectCode) {
      params.set('rentalObjectCode', key.rentalObjectCode)
    }
    return `/Keys?${params.toString()}`
  }

  const getContactDisplay = (loan: KeyLoanWithDetails) => {
    const codes = [loan.contact, loan.contact2].filter(Boolean) as string[]
    if (codes.length === 0) return null

    return codes.map((code) => {
      const data = contactData[code]
      return {
        fullName: data?.fullName || code,
        contactCode: data?.contactCode || code,
        nationalRegistrationNumber: data?.nationalRegistrationNumber,
      }
    })
  }

  if (items.length === 0) {
    return (
      <div className="border rounded-lg overflow-hidden bg-background p-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <CollapsibleGroupTable
      items={items}
      getItemId={(item) =>
        item.itemType === 'key' ? item.data.id : item.data.cardId
      }
      columnCount={COLUMN_COUNT}
      groupBy={(item) => item.parentLoan.id}
      initialExpanded="none"
      renderHeader={() => (
        <TableRow className="bg-background">
          <TableHead className="w-[18%]">Namn</TableHead>
          <TableHead className="w-[6%]">Löpnr</TableHead>
          <TableHead className="w-[6%]">Flex</TableHead>
          <TableHead className="w-[10%]">Låssystem</TableHead>
          <TableHead className="w-[12%]">Tillhörighet</TableHead>
          <TableHead className="w-[12%]">Hyresobjekt</TableHead>
          <TableHead className="w-[10%]">Typ</TableHead>
          <TableHead className="w-[10%]">Status</TableHead>
          <TableHead className="w-[8%]">Kassering</TableHead>
          <TableHead className="w-[8%]" />
        </TableRow>
      )}
      renderGroupHeader={(_loanId, groupItems) => {
        const loan = groupItems[0].parentLoan
        const contacts = getContactDisplay(loan)
        const itemCount =
          (loan.keysArray?.length || 0) + (loan.keyCardsArray?.length || 0)

        return (
          <div className="flex items-center justify-between flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              {contacts && contacts.length > 0 && (
                <span className="font-semibold">
                  {contacts.map((c) => c.fullName).join(', ')}
                </span>
              )}
              {contacts &&
                contacts.map((c) => (
                  <TableLink
                    key={c.contactCode}
                    to={`/maintenance-keys?contact=${c.contactCode}`}
                  >
                    {c.contactCode}
                  </TableLink>
                ))}
              {contacts &&
                contacts.some((c) => c.nationalRegistrationNumber) && (
                  <span className="text-muted-foreground text-sm">
                    {contacts
                      .map((c) => c.nationalRegistrationNumber || '-')
                      .join(', ')}
                  </span>
                )}
              {loan.contactPerson && (
                <span className="text-muted-foreground text-sm">
                  Kontaktperson: {loan.contactPerson}
                </span>
              )}
              <Badge variant="outline" className="text-xs">
                {itemCount} objekt
              </Badge>
              <LoanStatusBadge loan={loan} />
              <span className="text-muted-foreground text-sm">
                Skapad: {formatDate(loan.createdAt)}
              </span>
              {loan.pickedUpAt && (
                <span className="text-muted-foreground text-sm">
                  Upphämtat: {formatDate(loan.pickedUpAt)}
                </span>
              )}
              {loan.returnedAt && (
                <span className="text-muted-foreground text-sm">
                  Återlämnat: {formatDate(loan.returnedAt)}
                </span>
              )}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <LoanActionMenu
                loan={loan}
                onRefresh={() => onLoanUpdated?.(loan.id)}
                onReturn={() => onLoanReturned?.(loan.id)}
              />
            </div>
          </div>
        )
      }}
      renderRow={(item: MaintenanceLoanItem, { indent }: RowRenderProps) => {
        if (item.itemType === 'card') {
          const card = item.data
          const ownerId = extractCardOwnerId(card.owner)
          const ownerLink = ownerId ? getCardOwnerLink(ownerId) : null

          return (
            <TableRow key={card.cardId} className="bg-background h-12">
              <TableCell className={`w-[18%] ${indent ? 'pl-8' : ''}`}>
                <TableExternalLink
                  href={ownerLink}
                  onClick={(e) => e.stopPropagation()}
                >
                  {card.name || card.cardId}
                </TableExternalLink>
              </TableCell>
              <TableCellMuted className="w-[6%]">-</TableCellMuted>
              <TableCellMuted className="w-[6%]">-</TableCellMuted>
              <TableCellMuted className="w-[10%]">-</TableCellMuted>
              <TableCellMuted className="w-[12%]">-</TableCellMuted>
              <TableCellMuted className="w-[12%]">-</TableCellMuted>
              <TableCell className="w-[10%]">
                <ItemTypeBadge itemType="CARD" />
              </TableCell>
              <TableCell className="w-[10%]">
                <span className="text-muted-foreground">-</span>
              </TableCell>
              <TableCell className="w-[8%]">
                <ItemDisposedBadge isDisposed={card.disabled ?? false} isCard />
              </TableCell>
              <TableCell className="w-[8%]" />
            </TableRow>
          )
        }

        const key = item.data
        const latestEvent = getLatestActiveEvent(key)

        return (
          <TableRow key={key.id} className="bg-background h-12">
            <TableCell className={`w-[18%] ${indent ? 'pl-8' : ''}`}>
              <TableLink to={getKeyUrl(key)}>{key.keyName}</TableLink>
            </TableCell>
            <TableCellMuted className="w-[6%]">
              {key.keySequenceNumber ?? '-'}
            </TableCellMuted>
            <TableCellMuted className="w-[6%]">
              {key.flexNumber ?? '-'}
            </TableCellMuted>
            <TableCellMuted className="w-[10%]">
              {key.keySystemId ? keySystemMap[key.keySystemId] || '-' : '-'}
            </TableCellMuted>
            <TableCellMuted className="w-[12%]">
              {key.keySystem?.name || '-'}
            </TableCellMuted>
            <TableCellMuted className="w-[12%]">
              {key.rentalObjectCode || '-'}
            </TableCellMuted>
            <TableCell className="w-[10%]">
              <ItemTypeBadge itemType={key.keyType} />
            </TableCell>
            <TableCell className="w-[10%]">
              {latestEvent ? (
                <KeyEventBadge event={latestEvent} />
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="w-[8%]">
              <ItemDisposedBadge isDisposed={key.disposed ?? false} />
            </TableCell>
            <TableCell className="w-[8%]" />
          </TableRow>
        )
      }}
      className="border rounded-lg overflow-hidden bg-background"
    />
  )
}
