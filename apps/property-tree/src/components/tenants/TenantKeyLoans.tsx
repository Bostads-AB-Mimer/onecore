import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Badge } from '@/components/ui/v2/Badge'
import { Button } from '@/components/ui/v2/Button'
import { ExternalLink, Key, Loader2 } from 'lucide-react'
import { CollapsibleTable } from '@/components/ui/CollapsibleTable'
import { GET } from '@/services/api/core/base-api'
import { resolve } from '@/utils/env'
import { formatDate, LeaseStatus } from './lease-helpers'
import type { components } from '@/services/api/core/generated/api-types'
import type { Lease } from '@/services/api/core/lease-service'

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

function getStatusBadge(loan: KeyLoanWithDetails) {
  const status = getLoanStatus(loan)
  switch (status) {
    case 'active':
      return <Badge variant="success">Aktiv</Badge>
    case 'returned':
      return <Badge variant="secondary">Återlämnad</Badge>
    case 'not-picked-up':
      return <Badge variant="outline">Ej upphämtad</Badge>
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
  if (keys.length === 0) return null

  return (
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
  )
}

export function TenantKeyLoans({ contactCode, leases }: TenantKeyLoansProps) {
  const [loans, setLoans] = useState<KeyLoanWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeLeases = useMemo(() => {
    if (!leases?.length) return []
    return leases.filter(
      (l) => Number(l.status) !== LeaseStatus.Ended && l.status !== 'Ended'
    )
  }, [leases])

  useEffect(() => {
    const fetchLoans = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data, error: apiError } = await GET(
          '/key-loans/by-contact/{contact}/with-keys',
          { params: { path: { contact: contactCode } } }
        )
        if (apiError) {
          setError('Kunde inte hämta nyckellån')
          return
        }
        setLoans(data?.content ?? [])
      } catch {
        setError('Kunde inte hämta nyckellån')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLoans()
  }, [contactCode])

  const keysUrl = resolve('VITE_KEYS_URL', '')

  const openInKeysPortal = (rentalObjectCode: string) => {
    if (!keysUrl) return
    window.open(`${keysUrl}/KeyLoan?object=${rentalObjectCode}`, '_blank')
  }

  // Build table rows: one row per loan, plus rows for active leases with no loans
  const tableRows = useMemo<TableRow[]>(() => {
    // Build a lookup from rental object code to lease for matching loans to their lease type
    const leaseByRentalObject = new Map(
      activeLeases.map((l) => [l.rentalPropertyId, l])
    )

    const rows: TableRow[] = loans.map((loan) => {
      const rentalCodes = getLoanRentalObjects(loan)
      const matchedLease = rentalCodes
        .map((code) => leaseByRentalObject.get(code))
        .find(Boolean)
      return { kind: 'loan', loan, lease: matchedLease }
    })

    // Find active leases that have no associated key loans
    const coveredRentalObjects = new Set(
      loans.flatMap((loan) =>
        loan.keysArray.map((k) => k.rentalObjectCode).filter(Boolean)
      )
    )
    for (const lease of activeLeases) {
      if (!coveredRentalObjects.has(lease.rentalPropertyId)) {
        rows.push({ kind: 'no-loan', lease })
      }
    }

    return rows
  }, [loans, activeLeases])

  const columns = useMemo(
    () => [
      {
        key: 'loanType',
        label: 'Lånetyp',
        render: (row: TableRow) =>
          row.kind === 'loan' ? (
            row.lease?.type ?? formatLoanType(row.loan.loanType)
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
