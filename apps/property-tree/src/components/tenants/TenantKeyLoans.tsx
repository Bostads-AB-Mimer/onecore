import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Badge } from '@/components/ui/v2/Badge'
import { Button } from '@/components/ui/v2/Button'
import { ExternalLink, Key, Loader2 } from 'lucide-react'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { GET } from '@/services/api/core/base-api'
import { resolve } from '@/utils/env'
import type { components } from '@/services/api/core/generated/api-types'

type KeyLoanWithDetails = components['schemas']['KeyLoanWithDetails']

interface TenantKeyLoansProps {
  contactCode: string
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

export function TenantKeyLoans({ contactCode }: TenantKeyLoansProps) {
  const [loans, setLoans] = useState<KeyLoanWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const openLoanInKeysPortal = (loan: KeyLoanWithDetails) => {
    if (!keysUrl) return
    const rentalObjectCode = loan.keysArray[0]?.rentalObjectCode
    if (rentalObjectCode) {
      window.open(`${keysUrl}/KeyLoan?object=${rentalObjectCode}`, '_blank')
    } else {
      window.open(`${keysUrl}/key-loans?q=${contactCode}`, '_blank')
    }
  }

  const openAllInKeysPortal = () => {
    if (keysUrl) {
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
                onClick={() => openLoanInKeysPortal(loan)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            ),
          },
        ]
      : []),
  ]

  const mobileCardRenderer = (loan: KeyLoanWithDetails) => (
    <div className="space-y-3 w-full">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-sm font-medium">
            {formatLoanType(loan.loanType)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatDate(loan.createdAt)}
            {loan.pickedUpAt && ` · Upphämtat ${formatDate(loan.pickedUpAt)}`}
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
            onClick={() => openLoanInKeysPortal(loan)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Öppna
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Nyckellån
        </CardTitle>
        {keysUrl && loans.length > 0 && (
          <Button variant="outline" size="sm" onClick={openAllInKeysPortal}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Öppna i Nyckelportalen
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveTable
          data={loans}
          columns={columns}
          keyExtractor={(loan) => loan.id}
          emptyMessage="Inga nyckellån hittades"
          mobileCardRenderer={mobileCardRenderer}
        />
      </CardContent>
    </Card>
  )
}
