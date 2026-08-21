import { AlertTriangle, CheckCircle2 } from 'lucide-react'

import { Lease } from '@/services/api/core'

import { TabLayout } from '@/shared/ui/layout/TabLayout'

import { useRentalObjectRents } from '../hooks/useRentalObjectRents'

// Max monthly difference (kr) before the totals count as disagreeing.
// Allows for rounding: Xpand stores yearly amounts that we divide by 12.
const TOTAL_TOLERANCE_KR = 1

type DisplayRow = {
  description: string
  amount: number
  code?: string
  fromDate?: string
  toDate?: string
}

const isActiveToday = (row: DisplayRow) => {
  const now = new Date()
  return (
    (!row.fromDate || new Date(row.fromDate) <= now) &&
    (!row.toDate || new Date(row.toDate) >= now)
  )
}

const activeMonthlyTotal = (rows: DisplayRow[]) =>
  rows.filter(isActiveToday).reduce((sum, row) => sum + row.amount, 0)

// Same sort in all three columns so matching rows line up for comparison:
// tillsvidare rows first sorted by name; date-bounded rows second, grouped by
// article (names can embed months — "juli" sorts before "juni"), groups ordered
// by earliest start date and chronological within each group
const sortRows = (rows: DisplayRow[]) => {
  const groupKey = (row: DisplayRow) => row.code || row.description
  const earliestFrom = new Map<string, string>()
  for (const row of rows) {
    if (!row.toDate) continue
    const key = groupKey(row)
    const from = row.fromDate ?? ''
    const prev = earliestFrom.get(key)
    if (prev === undefined || from < prev) earliestFrom.set(key, from)
  }

  return [...rows].sort((a, b) => {
    const bounded = Number(!!a.toDate) - Number(!!b.toDate)
    if (bounded !== 0) return bounded

    if (!a.toDate) {
      const byName = a.description.localeCompare(b.description, 'sv', {
        sensitivity: 'base',
      })
      if (byName !== 0) return byName
      return (a.fromDate ?? '').localeCompare(b.fromDate ?? '')
    }

    const keyA = groupKey(a)
    const keyB = groupKey(b)
    if (keyA !== keyB) {
      const byGroupStart = (earliestFrom.get(keyA) ?? '').localeCompare(
        earliestFrom.get(keyB) ?? ''
      )
      if (byGroupStart !== 0) return byGroupStart
      return keyA.localeCompare(keyB)
    }
    return (a.fromDate ?? '').localeCompare(b.fromDate ?? '')
  })
}

const formatAmount = (amount: number) =>
  amount.toLocaleString('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatDate = (iso?: string) => (iso ? iso.slice(0, 10) : undefined)

const RentSourceCard = ({
  title,
  rows,
  isError,
  emptyText,
}: {
  title: string
  rows: DisplayRow[] | null | undefined
  isError?: boolean
  emptyText: string
}) => {
  if (isError) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-destructive">
          Kunde inte hämta hyresrader från {title}.
        </p>
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    )
  }

  const total = activeMonthlyTotal(rows)
  const sortedRows = sortRows(rows)

  return (
    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="space-y-2">
        {sortedRows.map((row, i) => {
          const active = isActiveToday(row)
          const from = formatDate(row.fromDate)
          const to = formatDate(row.toDate)
          return (
            <div
              key={i}
              className={`flex justify-between gap-4 text-sm ${
                active ? '' : 'text-muted-foreground'
              }`}
            >
              <div>
                <p className={active ? 'font-medium' : ''}>
                  {row.description || '—'}
                  {!active && ' (ej aktiv)'}
                </p>
                {(from || to) && (
                  <p className="text-xs text-muted-foreground">
                    {from ?? ''} – {to ?? 'tillsvidare'}
                  </p>
                )}
              </div>
              <p className="whitespace-nowrap tabular-nums">
                {formatAmount(row.amount)} kr
              </p>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between gap-4 mt-4 pt-3 border-t border-slate-200 text-sm font-semibold">
        <p>Totalt (aktiva rader)</p>
        <p className="whitespace-nowrap tabular-nums">
          {formatAmount(total)} kr/mån
        </p>
      </div>
    </div>
  )
}

export const RentRowsTabContent = ({
  rentalObjectCode,
  lease,
}: {
  rentalObjectCode: string
  lease?: Lease
}) => {
  const { tenfastQuery, legacyQuery } = useRentalObjectRents(rentalObjectCode)

  if (tenfastQuery.isLoading || legacyQuery.isLoading) {
    return (
      <TabLayout title="Hyresrader" showCard={true}>
        <div className="py-4">Laddar...</div>
      </TabLayout>
    )
  }

  const toDisplayRows = (
    rent:
      | {
          rows: {
            description: string
            amount: number
            code?: string
            fromDate?: string
            toDate?: string
          }[]
        }
      | undefined
  ): DisplayRow[] | undefined =>
    rent?.rows.map((row) => ({
      description: row.description,
      amount: row.amount,
      code: row.code,
      fromDate: row.fromDate,
      toDate: row.toDate,
    }))

  const tenfastRows = toDisplayRows(tenfastQuery.data?.rent)
  const legacyRows = toDisplayRows(legacyQuery.data?.rent)
  const leaseRows: DisplayRow[] | undefined = lease?.rentRows?.map((row) => ({
    description: row.label,
    amount: row.amount,
    code: row.articleId,
    fromDate: row.from,
    toDate: row.to,
  }))

  // The transition check compares the two object-level sources only;
  // the lease's rows include contract-specific items (rabatter, IMD) by design
  const comparison = (() => {
    if (tenfastQuery.isError || legacyQuery.isError) return null
    if (!tenfastRows && !legacyRows) return null

    if (!tenfastRows || !legacyRows) {
      return {
        ok: false,
        message: `Hyresrader saknas i ${!tenfastRows ? 'Tenfast' : 'Xpand'}.`,
      }
    }

    const tenfastTotal = activeMonthlyTotal(tenfastRows)
    const legacyTotal = activeMonthlyTotal(legacyRows)
    const diff = Math.abs(tenfastTotal - legacyTotal)

    if (diff > TOTAL_TOLERANCE_KR) {
      return {
        ok: false,
        message: `Totalbeloppen skiljer sig åt: Tenfast ${formatAmount(tenfastTotal)} kr/mån, Xpand ${formatAmount(legacyTotal)} kr/mån (differens ${formatAmount(diff)} kr).`,
      }
    }

    return { ok: true, message: 'Hyresraderna stämmer överens.' }
  })()

  return (
    <TabLayout title="Hyresrader" showCard={true}>
      <p className="text-sm text-muted-foreground">
        Jämförelse av hyresrader mellan Tenfast och Xpand under övergången.
        Beloppen visas per månad. Kontraktets rader visas som referens och ingår
        inte i jämförelsen.
      </p>

      {comparison && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium ${
            comparison.ok
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          {comparison.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {comparison.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <RentSourceCard
          title="Tenfast"
          rows={tenfastRows}
          isError={tenfastQuery.isError}
          emptyText="Inga hyresrader hittades i Tenfast."
        />
        <RentSourceCard
          title="Xpand"
          rows={legacyRows}
          isError={legacyQuery.isError}
          emptyText="Inga hyresrader hittades i Xpand."
        />
        <RentSourceCard
          title={lease ? `Kontrakt ${lease.leaseId}` : 'Kontrakt'}
          rows={leaseRows}
          emptyText="Inget aktivt kontrakt med hyresrader hittades."
        />
      </div>
    </TabLayout>
  )
}
