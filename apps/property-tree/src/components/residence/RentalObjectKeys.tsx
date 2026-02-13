import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Badge } from '@/components/ui/v2/Badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
import { ExternalLink, Key, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/v2/Button'
import { GET } from '@/services/api/core/base-api'
import { resolve } from '@/utils/env'
import type { components } from '@/services/api/core/generated/api-types'

type KeyItem = components['schemas']['Key']

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

interface RentalObjectKeysProps {
  rentalObjectCode: string
}

export function RentalObjectKeys({ rentalObjectCode }: RentalObjectKeysProps) {
  const [keys, setKeys] = useState<KeyItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const keysUrl = resolve('VITE_KEYS_URL', '')

  useEffect(() => {
    const fetchKeys = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data, error: apiError } = await GET(
          '/keys/by-rental-object/{rentalObjectCode}',
          { params: { path: { rentalObjectCode } } }
        )
        if (apiError) {
          setError('Kunde inte hämta nycklar')
          return
        }
        setKeys(data?.content ?? [])
      } catch {
        setError('Kunde inte hämta nycklar')
      } finally {
        setIsLoading(false)
      }
    }

    fetchKeys()
  }, [rentalObjectCode])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Nycklar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Hämtar nycklar...</span>
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
            Nycklar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">{error}</p>
        </CardContent>
      </Card>
    )
  }

  // Group keys by type for summary badges
  const typeCounts: Record<string, number> = {}
  for (const key of keys) {
    const label = KeyTypeLabels[key.keyType] || key.keyType
    typeCounts[label] = (typeCounts[label] || 0) + 1
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Nycklar
            <Badge variant="secondary" className="ml-1">
              {keys.length}
            </Badge>
          </div>
          {keysUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `${keysUrl}/KeyLoan?object=${rentalObjectCode}`,
                  '_blank'
                )
              }
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Nyckelportalen
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Inga nycklar kopplade till detta hyresobjekt
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(typeCounts).map(([label, count]) => (
                <Badge key={label} variant="outline">
                  {label}: {count}
                </Badge>
              ))}
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Namn</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Löpnr</TableHead>
                    <TableHead>Flex</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">
                        {key.keyName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {KeyTypeLabels[key.keyType] || key.keyType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.keySequenceNumber ?? '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {key.flexNumber ?? '-'}
                      </TableCell>
                      <TableCell>
                        {key.disposed ? (
                          <Badge variant="destructive">Kasserad</Badge>
                        ) : (
                          <Badge variant="success">Aktiv</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
