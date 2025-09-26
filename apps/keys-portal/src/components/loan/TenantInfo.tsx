import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { User, Calendar, MapPin, ArrowLeft } from 'lucide-react'
import type { Tenant, Lease, Address } from '@/services/api/leaseSearchService'

interface TenantInfoProps {
  tenant: Tenant
  contracts: Lease[]
  onClearSearch: () => void
  onSelectContract?: (lease: Lease) => void
}

function formatAddress(addr?: Address): string {
  if (!addr) return 'Okänd adress'
  const line1 = [addr.street, addr.number].filter(Boolean).join(' ').trim()
  const line2 = [addr.postalCode, addr.city].filter(Boolean).join(' ').trim()
  const s = [line1, line2].filter(Boolean).join(', ')
  return s || 'Okänd adress'
}

const fmtDate = (d?: Date) =>
  d
    ? (d instanceof Date ? d : new Date(d as any)).toLocaleDateString('sv-SE')
    : undefined

type DisplayStatus = 'active' | 'upcoming' | 'ended'

function toMs(x?: Date): number | undefined {
  if (!x) return undefined
  if (x instanceof Date) return x.getTime()
  const t = new Date(x as any).getTime()
  return Number.isNaN(t) ? undefined : t
}

function deriveLeaseStatus(lease: Lease): DisplayStatus {
  const now = Date.now()
  const start = toMs(lease.leaseStartDate)
  const end = toMs(lease.leaseEndDate)

  if (!start) return 'ended'
  const terminatedAt = toMs(lease.terminationDate)
  if (terminatedAt && terminatedAt < now) return 'ended'
  if (start > now) return 'upcoming'
  if (end && end < now) return 'ended'

  const lastDebit = toMs(lease.lastDebitDate)
  const notice = toMs(lease.noticeDate)
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000
  if (lastDebit && notice && now - lastDebit > NINETY_DAYS) return 'ended'

  return 'active'
}

function statusBadgeProps(s: DisplayStatus) {
  if (s === 'upcoming')
    return { text: 'Kommande', variant: 'secondary' as const }
  if (s === 'ended') return { text: 'Avslutat', variant: 'outline' as const }
  return { text: 'Aktiv', variant: 'default' as const }
}

export function TenantInfo({
  tenant,
  contracts,
  onClearSearch,
  onSelectContract,
}: TenantInfoProps) {
  const sortedContracts = [...contracts].sort((a, b) => {
    const av = toMs(a.leaseStartDate)
    const bv = toMs(b.leaseStartDate)
    const aVal = av ?? Number.MAX_SAFE_INTEGER
    const bVal = bv ?? Number.MAX_SAFE_INTEGER
    return aVal - bVal
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClearSearch}>
          <ArrowLeft className="h-4 w-4" />
          Tillbaka
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {tenant.firstName} {tenant.lastName}
          </CardTitle>
          <CardDescription>
            Personnummer: {tenant.nationalRegistrationNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tenant.emailAddress && (
            <p className="text-sm text-muted-foreground">
              E-post: {tenant.emailAddress}
            </p>
          )}
          {tenant.address && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {formatAddress(tenant.address)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kontrakt</CardTitle>
          <CardDescription>
            Välj ett kontrakt för att se tillhörande nycklar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedContracts.length === 0 ? (
            <p className="text-muted-foreground">Inga kontrakt hittades</p>
          ) : (
            sortedContracts.map((lease) => {
              const start = fmtDate(lease.leaseStartDate)
              const end = fmtDate(lease.leaseEndDate)
              const rentalLabel =
                lease.rentalPropertyId ||
                lease.rentalProperty?.rentalPropertyId ||
                'Okänt objekt'

              const addr1 = formatAddress(lease.address)
              const addr2 = formatAddress(lease.rentalProperty?.address)
              const addr = addr1 === 'Okänd adress' ? addr2 : addr1

              const monthlyRent = lease.rentInfo?.currentRent?.currentRent

              const status = deriveLeaseStatus(lease)
              const badge = statusBadgeProps(status)

              return (
                <Card
                  key={lease.leaseId}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onSelectContract?.(lease)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-medium">{rentalLabel}</h3>
                        {addr && (
                          <p className="text-sm text-muted-foreground">
                            {addr}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {start && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Från: {start}
                            </span>
                          )}
                          {end && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Till: {end}
                            </span>
                          )}
                          {lease.lastDebitDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Sista debiteringsdatum:{' '}
                              {fmtDate(lease.lastDebitDate)}
                            </span>
                          )}
                        </div>
                        {typeof monthlyRent === 'number' && (
                          <p className="text-sm text-muted-foreground">
                            Hyra: {monthlyRent.toLocaleString('sv-SE')} kr/mån
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={badge.variant}>{badge.text}</Badge>
                        <Button size="sm" variant="outline">
                          Visa nycklar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
