import { useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Home, Car, Package, Building } from 'lucide-react'
import type { Lease } from '@/services/types'
import { EmbeddedKeysList } from './EmbeddedKeysList'
import { deriveDisplayStatus, pickEndDate } from '@/lib/lease-status'

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

export function ContractCard({
  lease,
  defaultOpen = false,
}: {
  lease: Lease
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const derived = deriveDisplayStatus(lease)
  const { label, variant } = statusBadge(derived)
  const address = lease.address || lease.rentalProperty?.address

  const startStr = format(new Date(lease.leaseStartDate), 'dd MMM yyyy', {
    locale: sv,
  })
  const endIso = pickEndDate(lease)
  const endStr = endIso
    ? format(new Date(endIso), 'dd MMM yyyy', { locale: sv })
    : undefined
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
            >
              {open ? 'Dölj nycklar' : 'Visa nycklar'}
            </Button>
            <Badge variant={variant}>{label}</Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {address && (
          <div className="text-sm text-muted-foreground">
            {address.street} {address.number}, {address.postalCode}{' '}
            {address.city}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>
              {startStr} – {endStr ?? 'Tillsvidare'}
            </span>
          </div>
          <div className="text-xs">Objekt-ID: {lease.rentalPropertyId}</div>
        </div>

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
