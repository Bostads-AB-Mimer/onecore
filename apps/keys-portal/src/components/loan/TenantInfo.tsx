import { X, User, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Tenant, Lease, TenantAddress as Address } from '@/services/types'
import { useMemo } from 'react'
import { ContractCard } from './ContractCard'
import { deriveDisplayStatus } from '@/lib/lease-status'

function formatAddress(addr?: Address): string {
  if (!addr) return 'Okänd adress'
  const line1 = [addr.street, addr.number].filter(Boolean).join(' ').trim()
  const line2 = [addr.postalCode, addr.city].filter(Boolean).join(' ').trim()
  return [line1, line2].filter(Boolean).join(', ') || 'Okänd adress'
}

export function TenantInfo({
  tenant,
  contracts,
  onClearSearch,
}: {
  tenant: Tenant
  contracts: Lease[]
  onClearSearch: () => void
}) {
  const { activeContracts, upcomingContracts, endedContracts } = useMemo(() => {
    const active: Lease[] = []
    const upcoming: Lease[] = []
    const ended: Lease[] = []

    contracts.forEach((c) => {
      const s = deriveDisplayStatus(c)
      if (s === 'active') active.push(c)
      else if (s === 'upcoming') upcoming.push(c)
      else ended.push(c)
    })

    return {
      activeContracts: active,
      upcomingContracts: upcoming,
      endedContracts: ended,
    }
  }, [contracts])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Sökresultat</h2>
        <Button variant="outline" size="sm" onClick={onClearSearch}>
          <X className="h-4 w-4 mr-2" />
          Rensa sökning
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
          {tenant.phoneNumbers?.[0]?.phoneNumber && (
            <p className="text-sm text-muted-foreground">
              Telefon: {tenant.phoneNumbers[0].phoneNumber}
            </p>
          )}
          {tenant.address && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {formatAddress(tenant.address as Address)}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {activeContracts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">
                Aktiva kontrakt ({activeContracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeContracts.map((lease) => (
                <ContractCard key={lease.leaseId} lease={lease} />
              ))}
            </CardContent>
          </Card>
        )}

        {upcomingContracts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600">
                Kommande kontrakt ({upcomingContracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingContracts.map((lease) => (
                <ContractCard key={lease.leaseId} lease={lease} />
              ))}
            </CardContent>
          </Card>
        )}

        {endedContracts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground">
                Avslutade kontrakt ({endedContracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {endedContracts.map((lease) => (
                <ContractCard key={lease.leaseId} lease={lease} />
              ))}
            </CardContent>
          </Card>
        )}

        {activeContracts.length === 0 &&
          upcomingContracts.length === 0 &&
          endedContracts.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  Inga kontrakt att visa.
                </p>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  )
}
