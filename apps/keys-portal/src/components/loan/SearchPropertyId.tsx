// components/loan/SearchPropertyId.tsx
import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { fetchLeasesByRentalPropertyId } from '@/services/api/leaseSearchService'
import type { Lease, Tenant } from '@/services/types'

interface Props {
  onTenantFound: (tenant: Tenant | null, contracts: Lease[]) => void
}

export function SearchPropertyId({ onTenantFound }: Props) {
  const [rentalPropertyId, setRentalPropertyId] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSearch = async () => {
    const id = rentalPropertyId.trim()
    if (!id) {
      toast({
        title: 'Saknar värde',
        description: 'Ange ett rentalPropertyId.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const contracts = await fetchLeasesByRentalPropertyId(id, {
        includeUpcomingLeases: true,
        includeTerminatedLeases: true,
        includeContacts: true,
      })

      if (!contracts.length) {
        toast({
          title: 'Ingen träff',
          description: 'Hittade inga kontrakt för angivet rentalPropertyId.',
        })
        return
      }

      const tenant = pickPrimaryTenant(contracts)
      if (!tenant) {
        toast({
          title: 'Ingen hyresgäst hittades',
          description: 'Kunde inte identifiera en hyresgäst för detta objekt.',
          variant: 'destructive',
        })
        return
      }

      onTenantFound(null, contracts)
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as any).message)
          : 'Okänt fel'
      toast({
        title: 'Kunde inte söka',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Sök på hyresobjekt
        </CardTitle>
        <CardDescription>
          Ange ett hyresobjekt för att visa kontrakt och hyresgäst(er)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="XXX-XXX-XX-XXX"
            value={rentalPropertyId}
            onChange={(e) => setRentalPropertyId(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={handleSearch} className="gap-2" disabled={loading}>
            <Search className="h-4 w-4" />
            {loading ? 'Söker…' : 'Sök'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Format: XXX-XXX-XX-XXX (t.ex. 705-011-03-1234)
        </p>
      </CardContent>
    </Card>
  )
}

function pickPrimaryTenant(contracts: Lease[]): Tenant | null {
  // Prefer a tenant on an active lease; otherwise first lease’s first tenant.
  const isActive = (l: Lease) =>
    (l.status ?? '').toString().toLowerCase() === 'active'
  const primaryLease = contracts.find(isActive) ?? contracts[0]
  const t = primaryLease?.tenants?.[0]
  return (t as Tenant) ?? null
}
