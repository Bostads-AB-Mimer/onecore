import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Calendar,
  Home,
  Car,
  Package,
  Building,
  KeyRound,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { Lease, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'
import { EmbeddedKeysList } from './EmbeddedKeysList'
import { deriveDisplayStatus, pickEndDate } from '@/lib/lease-status'
import { generateMockKeys, countKeysByType } from '@/mockdata/mock-keys'
import { rentalObjectSearchService } from '@/services/api/rentalObjectSearchService'

const getLeaseTypeIcon = (type: string) => {
  const normalizedType = (type ?? '').toLowerCase()
  if (
    normalizedType.includes('apartment') ||
    normalizedType.includes('lägenhet')
  )
    return <Home className="w-4 h-4" />
  if (
    normalizedType.includes('parking') ||
    normalizedType.includes('parkering')
  )
    return <Car className="w-4 h-4" />
  if (normalizedType.includes('storage') || normalizedType.includes('förråd'))
    return <Package className="w-4 h-4" />
  if (normalizedType.includes('commercial') || normalizedType.includes('lokal'))
    return <Building className="w-4 h-4" />
  return <Home className="w-4 h-4" />
}

function statusBadge(status: 'active' | 'upcoming' | 'ended') {
  if (status === 'upcoming')
    return { label: 'Kommande', variant: 'secondary' as const }
  if (status === 'ended')
    return { label: 'Avslutat', variant: 'outline' as const }
  return { label: 'Aktivt', variant: 'default' as const }
}

type Props = {
  lease: Lease
  defaultOpen?: boolean
  rentalAddress?: string
}

export function ContractCard({
  lease,
  defaultOpen = false,
  rentalAddress,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [addressStr, setAddressStr] = useState<string | null>(
    rentalAddress ?? null
  )
  const [addrLoading, setAddrLoading] = useState<boolean>(!rentalAddress)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (rentalAddress) return
      setAddrLoading(true)
      const addr = await rentalObjectSearchService.getAddressByRentalId(
        lease.rentalPropertyId
      )
      if (!cancelled) {
        setAddressStr(addr)
        setAddrLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [lease.rentalPropertyId, rentalAddress])

  const derived = deriveDisplayStatus(lease)
  const { label, variant } = statusBadge(derived)

  const startStr = format(new Date(lease.leaseStartDate), 'dd MMM yyyy', {
    locale: sv,
  })
  const endIso = pickEndDate(lease)
  const endStr = endIso
    ? format(new Date(endIso), 'dd MMM yyyy', { locale: sv })
    : undefined

  const mockKeys = useMemo(
    () => generateMockKeys(lease.leaseId),
    [lease.leaseId]
  )
  const keyCounts = useMemo(() => countKeysByType(mockKeys), [mockKeys])
  const totalKeys = mockKeys.length
  const hasAnyKeys = totalKeys > 0
  const order: KeyType[] = ['LGH', 'PB', 'TP', 'GEM', 'FS', 'HN', 'HUS']

  const keysRegionId = `keys-${lease.leaseId}`

  return (
    <Card className="relative border-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {getLeaseTypeIcon(lease.type)}
            <span>{lease.leaseNumber}</span>
            <Badge variant="outline" className="text-xs">
              {(lease.type || 'Okänd').trim()}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={keysRegionId}
              className="flex items-center gap-1"
            >
              {open ? (
                <>
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  Dölj nycklar
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  Visa nycklar
                </>
              )}
            </Button>
            <Badge variant={variant}>{label}</Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground min-h-[1rem]">
          {addrLoading ? 'Hämtar adress…' : (addressStr ?? 'Okänd adress')}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>
              {startStr} – {endStr ?? 'Tillsvidare'}
            </span>
          </div>
          <div className="text-xs">Objekt-ID: {lease.rentalPropertyId}</div>
        </div>

        {hasAnyKeys && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <KeyRound className="h-4 w-4 opacity-80" aria-hidden="true" />
                <span>Nycklar</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {order.map((t) => {
                  const count = keyCounts[t] ?? 0
                  if (!count) return null
                  return (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full border px-2 h-6 text-xs text-foreground/80"
                      aria-label={`${KeyTypeLabels[t]}: ${count}`}
                      title={`${KeyTypeLabels[t]}: ${count}`}
                    >
                      {KeyTypeLabels[t]}
                      <span className="inline-flex items-center justify-center rounded-full bg-muted px-1 min-w-[1.25rem] h-4 text-[11px] font-medium">
                        {count}
                      </span>
                    </span>
                  )
                })}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              Antal Nycklar:{' '}
              <span className="font-medium text-foreground">{totalKeys}</span>
            </span>
          </div>
        )}

        {lease.tenants && lease.tenants.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Hyresgäst: {lease.tenants[0].firstName} {lease.tenants[0].lastName}
          </div>
        )}

        {open && (
          <div id={keysRegionId} className="pt-3">
            <EmbeddedKeysList lease={lease} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
