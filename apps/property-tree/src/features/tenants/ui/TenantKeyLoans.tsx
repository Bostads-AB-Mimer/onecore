import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Key, Loader2 } from 'lucide-react'

import { formatDate, LeaseStatus } from '@/entities/lease'

import { GET } from '@/services/api/core/baseApi'
import type { components } from '@/services/api/core/generated/api-types'
import type { Lease } from '@/services/api/core/leaseService'

import { resolve } from '@/shared/lib/env'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { CollapsibleTable } from '@/shared/ui/CollapsibleTable'

type KeyLoanWithDetails = components['schemas']['KeyLoanWithDetails']

type TableRow =
  | { kind: 'loan'; loan: KeyLoanWithDetails; lease?: Lease }
  | { kind: 'no-loan'; lease: Lease }

const KeyTypeLabels: Record<string, string> = {
  HN: 'Huvudnyckel',
  FS: 'Fastighet',
  MV: 'Motorvärmarnyckel',
  LGH: 'Lägenhet',
  PB: 'Postbox',
  GAR: 'Garagenyckel',
  LOK: 'Lokalnyckel',
  HL: 'Hänglås',
  FÖR: 'Förrådsnyckel',
  SOP: 'Sopsug',
  ÖVR: 'Övrigt',
}

interface TenantKeyLoansProps {
  contactCode: string
  leases?: Lease[]
}

function getLoanStatus(loan: KeyLoanWithDetails) {
  if (loan.returnedAt) return 'returned'
  if (loan.pickedUpAt) return 'active'
  return 'not-picked-up'
}

function getPickupAvailabilityBadge(loan: KeyLoanWithDetails) {
  const availableFrom = loan.availableToNextTenantFrom
  if (!availableFrom) return null

  const availableDate = new Date(availableFrom)
  const now = new Date()
  const formattedDate = availableDate.toLocaleDateString('sv-SE')

  if (availableDate > now) {
    return <Badge variant="destructive">Får lämnas ut {formattedDate}</Badge>
  }
  return <Badge variant="default">Får lämnas ut från {formattedDate}</Badge>
}

function getStatusBadge(loan: KeyLoanWithDetails) {
  const status = getLoanStatus(loan)
  switch (status) {
    case 'active':
      return <Badge variant="success">Aktiv</Badge>
    case 'returned':
      return <Badge variant="secondary">Återlämnad</Badge>
    case 'not-picked-up':
      return (
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">Ej upphämtad</Badge>
          {getPickupAvailabilityBadge(loan)}
        </div>
      )
  }
}

function formatLoanType(loanType: string) {
  switch (loanType) {
    case 'TENANT':
      return 'Hyresgäst'
    case 'MAINTENANCE':
      return 'Underhåll'
    default:
      return loanType
  }
}

function formatDateOrDash(date: string | null | undefined) {
  return date ? formatDate(date) : '-'
}

function getLoanRentalObjects(loan: KeyLoanWithDetails): string[] {
  const codes = new Set<string>()
  for (const key of loan.keysArray) {
    if (key.rentalObjectCode) codes.add(key.rentalObjectCode)
  }
  return [...codes]
}

function LoanKeysDetail({ loan }: { loan: KeyLoanWithDetails }) {
  const keys = loan.keysArray
  const cards = loan.keyCardsArray ?? []
  if (keys.length === 0 && cards.length === 0) return null

  return (
    <div className="space-y-4">
      {keys.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Nycklar i lånet
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground text-xs">
                <th className="pb-1 pr-4 font-medium">Nyckelnamn</th>
                <th className="pb-1 pr-4 font-medium">Typ</th>
                <th className="pb-1 pr-4 font-medium">Löpnr</th>
                <th className="pb-1 font-medium">Hyresobjekt</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-border/50">
                  <td className="py-1.5 pr-4">{key.keyName}</td>
                  <td className="py-1.5 pr-4">
                    <Badge variant="secondary">
                      {KeyTypeLabels[key.keyType] || key.keyType}
                    </Badge>
                  </td>
                  <td className="py-1.5 pr-4 text-muted-foreground">
                    {key.keySequenceNumber ?? '-'}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {key.rentalObjectCode || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cards.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Taggar i lånet
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground text-xs">
                <th className="pb-1 pr-4 font-medium">Taggnamn</th>
                <th className="pb-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.cardId} className="border-t border-border/50">
                  <td className="py-1.5 pr-4">{card.name || card.cardId}</td>
                  <td className="py-1.5">
                    <Badge variant={card.disabled ? 'destructive' : 'success'}>
                      {card.disabled ? 'Spärrat' : 'Aktivt'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function TenantKeyLoans({ contactCode, leases }: TenantKeyLoansProps) {
  const [loansByRentalObject, setLoansByRentalObject] = useState<
    Map<string, KeyLoanWithDetails[]>
  >(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeLeases = useMemo(() => {
    if (!leases?.length) return []
    return leases.filter(
      (l) => Number(l.status) !== LeaseStatus.Ended && l.status !== 'Ended'
    )
  }, [leases])

  const rentalObjectCodes = useMemo(
    () => [...new Set(activeLeases.map((l) => l.rentalPropertyId))],
    [activeLeases]
  )

  const rentalObjectCodesKey = rentalObjectCodes.join(',')

  useEffect(() => {
    const fetchLoans = async () => {
      setIsLoading(true)
      setError(null)
      try {
        if (rentalObjectCodes.length > 0) {
          const results = await Promise.all(
            rentalObjectCodes.map((code) =>
              GET('/key-loans/by-rental-object/{rentalObjectCode}', {
                params: {
                  path: { rentalObjectCode: code },
                  query: { contact: contactCode },
                },
              }).then((res) => ({ code, ...res }))
            )
          )

          const byRentalObject = new Map<string, KeyLoanWithDetails[]>()
          for (const { code, data, error: apiError } of results) {
            if (apiError) continue
            byRentalObject.set(code, data?.content ?? [])
          }
          setLoansByRentalObject(byRentalObject)
        } else {
          // Fallback: search by contact code when there are no active leases
          const { data, error: apiError } = await GET(
            '/key-loans/by-contact/{contact}/with-keys',
            { params: { path: { contact: contactCode } } }
          )
          if (apiError) {
            setError('Kunde inte hämta nyckellån')
            return
          }
          // Group by rental object code from keys
          const byRentalObject = new Map<string, KeyLoanWithDetails[]>()
          for (const loan of data?.content ?? []) {
            const codes = getLoanRentalObjects(loan)
            const key = codes[0] ?? 'unknown'
            const existing = byRentalObject.get(key) ?? []
            existing.push(loan)
            byRentalObject.set(key, existing)
          }
          setLoansByRentalObject(byRentalObject)
        }
      } catch {
        setError('Kunde inte hämta nyckellån')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLoans()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rentalObjectCodesKey is a stable string derived from rentalObjectCodes
  }, [contactCode, rentalObjectCodesKey])

  const keysUrl = resolve('VITE_KEYS_URL', '')

  const openInKeysPortal = (rentalObjectCode: string) => {
    if (!keysUrl) return
    window.open(`${keysUrl}/KeyLoan?object=${rentalObjectCode}`, '_blank')
  }

  // Build table rows: one row per loan, plus rows for active leases with no loans
  const tableRows = useMemo<TableRow[]>(() => {
    const leaseByRentalObject = new Map(
      activeLeases.map((l) => [l.rentalPropertyId, l])
    )

    const rows: TableRow[] = []
    const coveredRentalObjects = new Set<string>()

    for (const [rentalObjectCode, loans] of loansByRentalObject) {
      const lease = leaseByRentalObject.get(rentalObjectCode)
      for (const loan of loans) {
        rows.push({ kind: 'loan', loan, lease })
      }
      coveredRentalObjects.add(rentalObjectCode)
    }

    // Add rows for active leases that have no key loans
    for (const lease of activeLeases) {
      if (!coveredRentalObjects.has(lease.rentalPropertyId)) {
        rows.push({ kind: 'no-loan', lease })
      }
    }

    return rows
  }, [loansByRentalObject, activeLeases])

  const columns = useMemo(
    () => [
      {
        key: 'loanType',
        label: 'Lånetyp',
        render: (row: TableRow) =>
          row.kind === 'loan' ? (
            (row.lease?.type ?? formatLoanType(row.loan.loanType))
          ) : (
            <span className="text-muted-foreground">{row.lease.type}</span>
          ),
      },
      {
        key: 'rentalObject',
        label: 'Hyresobjekt',
        render: (row: TableRow) => {
          if (row.kind === 'no-loan') return row.lease.rentalPropertyId
          const codes = getLoanRentalObjects(row.loan)
          if (codes.length === 0)
            return <span className="text-muted-foreground">-</span>
          return (
            <div className="space-y-0.5">
              {codes.map((code) => (
                <div key={code} className="text-sm">
                  {code}
                </div>
              ))}
            </div>
          )
        },
      },
      {
        key: 'keyCount',
        label: 'Antal nycklar',
        render: (row: TableRow) =>
          row.kind === 'loan' ? (
            <Badge variant="secondary">{row.loan.keysArray.length}</Badge>
          ) : (
            <Badge variant="secondary">0</Badge>
          ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (row: TableRow) =>
          row.kind === 'loan' ? (
            getStatusBadge(row.loan)
          ) : (
            <Badge variant="success">Aktiv</Badge>
          ),
      },
      {
        key: 'createdAt',
        label: 'Skapad',
        render: (row: TableRow) =>
          row.kind === 'loan' ? formatDateOrDash(row.loan.createdAt) : '-',
      },
      {
        key: 'pickedUpAt',
        label: 'Upphämtat',
        render: (row: TableRow) =>
          row.kind === 'loan' ? formatDateOrDash(row.loan.pickedUpAt) : '-',
      },
      {
        key: 'returnedAt',
        label: 'Återlämnat',
        render: (row: TableRow) =>
          row.kind === 'loan' ? formatDateOrDash(row.loan.returnedAt) : '-',
      },
      ...(keysUrl
        ? [
            {
              key: 'actions',
              label: '',
              render: (row: TableRow) => {
                const rentalObjectCode =
                  row.kind === 'loan'
                    ? row.loan.keysArray[0]?.rentalObjectCode
                    : row.lease.rentalPropertyId
                if (!rentalObjectCode) return null
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation()
                      openInKeysPortal(rentalObjectCode)
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )
              },
            },
          ]
        : []),
    ],
    [keysUrl]
  )

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Nyckellån
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Hämtar nyckellån...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Nyckellån
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Nyckellån
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CollapsibleTable<TableRow>
          data={tableRows}
          columns={columns}
          keyExtractor={(row) =>
            row.kind === 'loan' ? row.loan.id : `lease-${row.lease.leaseId}`
          }
          expandedContentRenderer={(row) =>
            row.kind === 'loan' ? (
              <LoanKeysDetail loan={row.loan} />
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                Inga nycklar eller nyckellån för detta hyresobjekt
              </p>
            )
          }
          expansionConfig={{
            allowMultiple: true,
            chevronPosition: 'start',
          }}
          isExpandable={() => true}
          mobileCardConfig={{
            summaryRenderer: (row) => {
              if (row.kind === 'no-loan') {
                return (
                  <div className="space-y-2 w-full">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium">
                          {row.lease.rentalPropertyId}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {row.lease.type}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Inga nyckellån
                      </span>
                    </div>
                    {keysUrl && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation()
                            openInKeysPortal(row.lease.rentalPropertyId)
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Öppna
                        </Button>
                      </div>
                    )}
                  </div>
                )
              }
              const { loan } = row
              return (
                <div className="space-y-3 w-full">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium">
                        {row.lease?.type ?? formatLoanType(loan.loanType)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDateOrDash(loan.createdAt)}
                        {loan.pickedUpAt &&
                          ` · Upphämtat ${formatDateOrDash(loan.pickedUpAt)}`}
                      </div>
                    </div>
                    {getStatusBadge(loan)}
                  </div>
                  {(() => {
                    const rentalCodes = getLoanRentalObjects(loan)
                    return rentalCodes.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        {rentalCodes.join(', ')}
                      </div>
                    ) : null
                  })()}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      {loan.keysArray.length} nycklar
                    </span>
                    {keysUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          openInKeysPortal(
                            loan.keysArray[0]?.rentalObjectCode ?? ''
                          )
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Öppna
                      </Button>
                    )}
                  </div>
                </div>
              )
            },
          }}
          emptyMessage="Inga nyckellån hittades"
        />
      </CardContent>
    </Card>
  )
}
