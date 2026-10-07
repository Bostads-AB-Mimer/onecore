import { format } from 'date-fns'
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableCellMuted,
  TableEmptyState,
  TableHead,
  TableHeader,
  TableRow,
  TableLink,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { FilterableTableHeader } from '@/components/shared/tables/FilterableTableHeader'
import { MoveInOutStatusBadge } from '@/components/shared/tables/StatusBadges'
import type { MoveInOutSortKey } from '@/services/api/moveInOutService'
import type { MoveInOutRow, MoveInOutTenant } from '@/services/types'

const COLUMN_COUNT = 11

interface MoveInOutTableProps {
  rows: MoveInOutRow[]
  isLoading: boolean
  /** Shown in the table instead of the empty state when the request failed */
  error?: string | null
  sortKey: MoveInOutSortKey
  sortOrder: 'asc' | 'desc'
  onSortChange: (key: MoveInOutSortKey) => void
}

const fmtDate = (value: string | null | undefined) =>
  value ? format(new Date(value), 'yyyy-MM-dd') : null

function TenantCell({ tenant }: { tenant: MoveInOutTenant | null }) {
  if (!tenant) return <TableCellMuted>Vakant</TableCellMuted>
  return (
    <TableCell>
      <div className="flex flex-col">
        {tenant.names.map((name, i) => (
          <span key={tenant.contactCodes[i] ?? i}>
            {name || tenant.contactCodes[i]}
          </span>
        ))}
        <span className="text-xs">
          {tenant.contactCodes.map((code, i) => (
            <span key={code}>
              {i > 0 && ', '}
              <TableLink to={`/KeyLoan?tenant=${code}`}>{code}</TableLink>
            </span>
          ))}
        </span>
      </div>
    </TableCell>
  )
}

function DateCell({
  value,
  check,
}: {
  value: string | null | undefined
  check?: boolean | null
}) {
  const text = fmtDate(value)
  if (!text) return <TableCellMuted>-</TableCellMuted>
  return (
    <TableCell className="whitespace-nowrap">
      <span className="inline-flex items-center gap-1">
        {check && <Check className="h-3.5 w-3.5 text-green-600" />}
        {text}
      </span>
    </TableCell>
  )
}

function SortButton({
  active,
  order,
  onClick,
}: {
  active: boolean
  order: 'asc' | 'desc'
  onClick: () => void
}) {
  const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 hover:bg-muted"
      onClick={onClick}
    >
      <Icon className="h-3 w-3" />
    </Button>
  )
}

export function MoveInOutTable({
  rows,
  isLoading,
  error,
  sortKey,
  sortOrder,
  onSortChange,
}: MoveInOutTableProps) {
  const sort = (key: MoveInOutSortKey) => (
    <SortButton
      active={sortKey === key}
      order={sortOrder}
      onClick={() => onSortChange(key)}
    />
  )

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <FilterableTableHeader label="Objekt">
              {sort('rentalObjectCode')}
            </FilterableTableHeader>
            <TableHead>Typ</TableHead>
            <TableHead>Utflyttande</TableHead>
            <FilterableTableHeader label="Utflytt">
              {sort('lastDebitDate')}
            </FilterableTableHeader>
            <TableHead>Inflyttande</TableHead>
            <FilterableTableHeader label="Inflytt">
              {sort('leaseStartDate')}
            </FilterableTableHeader>
            <TableHead className="text-center">Nycklar / Kort</TableHead>
            <TableHead>Återlämnat</TableHead>
            <TableHead>Lån skapat</TableHead>
            <TableHead>Utlämnat</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading || rows.length === 0 ? (
            <TableEmptyState
              colSpan={COLUMN_COUNT}
              isLoading={isLoading}
              message={error ?? 'Inga in- eller utflyttar i perioden'}
            />
          ) : (
            rows.map((row) => (
              <TableRow key={row.rentalObjectCode}>
                <TableCell>
                  <div className="flex flex-col">
                    <TableLink to={`/KeyLoan?object=${row.rentalObjectCode}`}>
                      {row.rentalObjectCode}
                    </TableLink>
                    {row.address && (
                      <span className="text-xs text-muted-foreground">
                        {row.address}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{row.objectTypeCode ?? '-'}</TableCell>
                <TenantCell tenant={row.outgoing} />
                <DateCell value={row.outgoing?.lastDebitDate} />
                <TenantCell tenant={row.incoming} />
                <DateCell value={row.incoming?.leaseStartDate} />
                <TableCell className="text-center whitespace-nowrap">
                  {row.keyCount} / {row.cardCount}
                </TableCell>
                <DateCell
                  value={row.outgoingReturnedAt}
                  check={row.outgoingAllReturned}
                />
                <DateCell value={row.incomingLoanCreatedAt} />
                <DateCell value={row.incomingLoanPickedUpAt} />
                <TableCell>
                  <MoveInOutStatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
