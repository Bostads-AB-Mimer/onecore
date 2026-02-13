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
import type { components } from '@/services/api/core/generated/api-types'
import type { Lease } from '@/services/api/core/lease-service'

type KeyLoanWithDetails = components['schemas']['KeyLoanWithDetails']

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

function formatDate(date: string | null | undefined) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('sv-SE')
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

  const rentalObjectCodes = useMemo(() => {
    if (!leases?.length) return []
    return [...new Set(leases.map((l) => l.rentalPropertyId))]
  }, [leases])

  useEffect(() => {
    const fetchLoans = async () => {
      setIsLoading(true)
      setError(null)
      try {
        let allLoans: KeyLoanWithDetails[] = []

        if (rentalObjectCodes.length > 0) {
          // Search by rental objects from the tenant's leases — catches loans
          // regardless of which contact code they were registered under
          const results = await Promise.all(
            rentalObjectCodes.map((code) =>
              GET('/key-loans/by-rental-object/{rentalObjectCode}', {
                params: { path: { rentalObjectCode: code } },
              })
            )
          )
          const seen = new Set<string>()
          for (const { data, error: apiError } of results) {
            if (apiError) continue
            for (const loan of data?.content ?? []) {
              if (!seen.has(loan.id)) {
                seen.add(loan.id)
                allLoans.push(loan)
              }
            }
          }
        } else {
          // Fallback: search by contact code directly
          const { data, error: apiError } = await GET(
            '/key-loans/by-contact/{contact}/with-keys',
            { params: { path: { contact: contactCode } } }
          )
          if (apiError) {
            setError('Kunde inte hämta nyckellån')
            return
          }
          allLoans = data?.content ?? []
        }

        setLoans(allLoans)
      } catch {
        setError('Kunde inte hämta nyckellån')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLoans()
  }, [contactCode, rentalObjectCodes])

  const keysUrl = resolve('VITE_KEYS_URL', '')

  const openLoanInKeysPortal = (loan: KeyLoanWithDetails) => {
    if (!keysUrl) return
    const rentalObjectCode = loan.keysArray[0]?.rentalObjectCode
    if (rentalObjectCode) {
      window.open(`${keysUrl}/KeyLoan?object=${rentalObjectCode}`, '_blank')
    } else {
      window.open(`${keysUrl}/key-loans?q=${contactCode}`, '_blank')
    }
  }

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

  const columns = [
    {
      key: 'loanType',
      label: 'Lånetyp',
      render: (loan: KeyLoanWithDetails) => formatLoanType(loan.loanType),
    },
    {
      key: 'keyCount',
      label: 'Antal nycklar',
      render: (loan: KeyLoanWithDetails) => (
        <Badge variant="secondary">{loan.keysArray.length}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (loan: KeyLoanWithDetails) => getStatusBadge(loan),
    },
    {
      key: 'createdAt',
      label: 'Skapad',
      render: (loan: KeyLoanWithDetails) => formatDate(loan.createdAt),
    },
    {
      key: 'pickedUpAt',
      label: 'Upphämtat',
      render: (loan: KeyLoanWithDetails) => formatDate(loan.pickedUpAt),
    },
    {
      key: 'returnedAt',
      label: 'Återlämnat',
      render: (loan: KeyLoanWithDetails) => formatDate(loan.returnedAt),
    },
    ...(keysUrl
      ? [
          {
            key: 'actions',
            label: '',
            render: (loan: KeyLoanWithDetails) => (
              <Button
                variant="outline"
                size="sm"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  openLoanInKeysPortal(loan)
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Nyckellån
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CollapsibleTable<KeyLoanWithDetails>
          data={loans}
          columns={columns}
          keyExtractor={(loan) => loan.id}
          expandedContentRenderer={(loan) => <LoanKeysDetail loan={loan} />}
          expansionConfig={{
            allowMultiple: true,
            chevronPosition: 'start',
          }}
          isExpandable={(loan) => loan.keysArray.length > 0}
          mobileCardConfig={{
            summaryRenderer: (loan) => (
              <div className="space-y-3 w-full">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium">
                      {formatLoanType(loan.loanType)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(loan.createdAt)}
                      {loan.pickedUpAt &&
                        ` · Upphämtat ${formatDate(loan.pickedUpAt)}`}
                    </div>
                  </div>
                  {getStatusBadge(loan)}
                </div>
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
                        openLoanInKeysPortal(loan)
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Öppna
                    </Button>
                  )}
                </div>
              </div>
            ),
          }}
          emptyMessage="Inga nyckellån hittades"
        />
      </CardContent>
    </Card>
  )
}
