import { useQuery } from '@tanstack/react-query'
import { ExternalLink, KeyRound, Loader2 } from 'lucide-react'
import { keyLoanService } from '@/services/api/keyLoanService'
import { keyService } from '@/services/api/keyService'
import { Button } from '@/components/ui/v2/Button'
import { Badge } from '@/components/ui/v2/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
import { KeyTypeLabels, type Key, type KeyLoan } from '@/services/types'

interface TenantKeyLoansProps {
  rentalPropertyId: string
}

interface KeyLoanWithKeyDetails {
  loan: KeyLoan
  keys: Key[]
}

interface EnrichedData {
  loans: KeyLoanWithKeyDetails[]
  keySystemMap: Record<string, string>
}

export function TenantKeyLoans({ rentalPropertyId }: TenantKeyLoansProps) {
  // Fetch key loans for this rental property
  const keyLoansQuery = useQuery({
    queryKey: ['keyLoans', rentalPropertyId],
    queryFn: () => keyLoanService.getByRentalPropertyId(rentalPropertyId),
  })

  // Enrich loans with key details and fetch key systems
  const enrichedLoansQuery = useQuery({
    queryKey: ['enrichedKeyLoans', rentalPropertyId, keyLoansQuery.data],
    queryFn: async (): Promise<EnrichedData> => {
      if (!keyLoansQuery.data) return { loans: [], keySystemMap: {} }

      const { activeLoans } = keyLoansQuery.data
      const enriched: KeyLoanWithKeyDetails[] = []

      for (const loan of activeLoans) {
        try {
          // Parse the keys JSON array to get key IDs
          const keyIds: string[] = JSON.parse(loan.keys || '[]')

          // Fetch details for each key
          const keyPromises = keyIds.map((keyId) => keyService.getById(keyId))
          const keys = (await Promise.all(keyPromises)).filter(
            (key): key is Key => key !== null
          )

          enriched.push({ loan, keys })
        } catch (error) {
          console.error('Error enriching key loan:', error)
        }
      }

      // Collect unique key system IDs from all keys
      const uniqueKeySystemIds = [
        ...new Set(
          enriched
            .flatMap(({ keys }) => keys)
            .map((key) => key.keySystemId)
            .filter((id): id is string => id != null && id !== '')
        ),
      ]

      // Fetch key system names
      const keySystemMap: Record<string, string> = {}
      if (uniqueKeySystemIds.length > 0) {
        await Promise.all(
          uniqueKeySystemIds.map(async (id) => {
            try {
              const keySystem = await keyService.getKeySystem(id)
              if (keySystem?.systemCode) {
                keySystemMap[id] = keySystem.systemCode
              }
            } catch (error) {
              console.error(`Failed to fetch key system ${id}:`, error)
            }
          })
        )
      }

      return { loans: enriched, keySystemMap }
    },
    enabled: !!keyLoansQuery.data,
  })

  const handleOpenInKeysPortal = () => {
    const keysPortalUrl = `http://localhost:3010/KeyLoan?object=${rentalPropertyId}`
    window.open(keysPortalUrl, '_blank')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  const getKeyTypeVariant = (type: string) => {
    switch (type) {
      case 'LGH':
        return 'default'
      case 'PB':
        return 'secondary'
      case 'FS':
        return 'outline'
      case 'HN':
        return 'destructive'
      case 'MV':
        return 'default'
      case 'GAR':
        return 'secondary'
      case 'LOK':
        return 'outline'
      case 'HL':
        return 'secondary'
      case 'FÖR':
        return 'default'
      case 'SOP':
        return 'outline'
      case 'ÖVR':
        return 'secondary'
      default:
        return 'default'
    }
  }

  if (keyLoansQuery.isLoading || enrichedLoansQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (keyLoansQuery.error) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Kunde inte hämta lägenhetens nycklar
      </div>
    )
  }

  const enrichedData = enrichedLoansQuery.data || {
    loans: [],
    keySystemMap: {},
  }
  const { loans: enrichedLoans, keySystemMap } = enrichedData

  if (enrichedLoans.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Inga aktiva nyckellån
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-slate-500" />
          <h4 className="font-medium">Lägenhetens nycklar</h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenInKeysPortal}
          className="shrink-0"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Öppna i Nyckelportalen
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nyckeltyp</TableHead>
              <TableHead>Nyckelnamn</TableHead>
              <TableHead>Flexnummer</TableHead>
              <TableHead>Nyckelsystem</TableHead>
              <TableHead>Löpnummer</TableHead>
              <TableHead>Utlämningsdatum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrichedLoans.map(({ loan, keys }) =>
              keys.map((key) => (
                <TableRow key={`${loan.id}-${key.id}`}>
                  <TableCell>
                    <Badge variant={getKeyTypeVariant(key.keyType)}>
                      {KeyTypeLabels[
                        key.keyType as keyof typeof KeyTypeLabels
                      ] || key.keyType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{key.keyName}</TableCell>
                  <TableCell>{key.flexNumber || '-'}</TableCell>
                  <TableCell>
                    {key.keySystemId && keySystemMap[key.keySystemId]
                      ? keySystemMap[key.keySystemId]
                      : key.keySystemId || '-'}
                  </TableCell>
                  <TableCell>{key.keySequenceNumber || '-'}</TableCell>
                  <TableCell>
                    {loan.pickedUpAt
                      ? formatDate(loan.pickedUpAt)
                      : loan.createdAt
                        ? formatDate(loan.createdAt)
                        : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
