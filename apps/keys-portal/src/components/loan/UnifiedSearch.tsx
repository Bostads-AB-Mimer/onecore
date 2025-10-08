import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import {
  fetchTenantAndLeasesByPnr,
  fetchLeasesByRentalPropertyId,
} from '@/services/api/leaseSearchService'
import type { Lease, Tenant } from '@/services/types'

interface UnifiedSearchProps {
  onResultFound: (
    tenant: Tenant | null,
    contracts: Lease[],
    searchValue: string,
    type: 'pnr' | 'object'
  ) => void
}

const isValidPnr = (value: string) =>
  /^(?:\d{6}|\d{8})-?\d{4}$/.test(value.trim())

const isObjectId = (value: string) => {
  const trimmed = value.trim()
  // Check if there's a dash in the first 5 characters
  const first5 = trimmed.substring(0, 5)
  return first5.includes('-')
}

function pickPrimaryTenant(contracts: Lease[]): Tenant | null {
  const isActive = (l: Lease) =>
    (l.status ?? '').toString().toLowerCase() === 'active'
  const primaryLease = contracts.find(isActive) ?? contracts[0]
  const t = primaryLease?.tenants?.[0]
  return (t as Tenant) ?? null
}

export function UnifiedSearch({ onResultFound }: UnifiedSearchProps) {
  const [searchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSearch = async () => {
    const value = searchValue.trim()
    if (!value) {
      toast({
        title: 'Saknar värde',
        description: 'Ange personnummer eller hyresobjekt.',
        variant: 'destructive',
      })
      return
    }

    // Determine search type based on format
    if (isObjectId(value)) {
      await handleSearchByObjectId(value)
    } else if (isValidPnr(value)) {
      await handleSearchByPnr(value)
    } else {
      toast({
        title: 'Ogiltigt format',
        description:
          'Ange personnummer (YYYYMMDD-XXXX) eller hyresobjekt (XXX-XXX-XX-XXX).',
        variant: 'destructive',
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  // Trigger search when URL parameters are present
  useEffect(() => {
    const tenantParam = searchParams.get('tenant')
    const objectParam = searchParams.get('object')

    if (tenantParam && isValidPnr(tenantParam)) {
      setSearchValue(tenantParam)
      handleSearchByPnr(tenantParam)
    } else if (objectParam && objectParam.trim()) {
      setSearchValue(objectParam)
      handleSearchByObjectId(objectParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleSearchByPnr = async (pnr: string) => {
    setLoading(true)
    try {
      const result = await fetchTenantAndLeasesByPnr(pnr)
      if (!result) {
        toast({
          title: 'Ingen träff',
          description: 'Hittade ingen hyresgäst för angivet personnummer.',
        })
        return
      }
      onResultFound(result.tenant, result.contracts, pnr, 'pnr')
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

  const handleSearchByObjectId = async (id: string) => {
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
          description: 'Hittade inga kontrakt för angivet hyresobjekt.',
        })
        return
      }

      const tenant = pickPrimaryTenant(contracts)
      onResultFound(tenant, contracts, id, 'object')
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Sök hyresgäst eller hyresobjekt
        </CardTitle>
        <CardDescription>
          Ange personnummer eller hyresobjekt för att hitta kontrakt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Personnummer eller hyresobjekt"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={handleSearch} className="gap-2" disabled={loading}>
            <Search className="h-4 w-4" />
            {loading ? 'Söker…' : 'Sök'}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Personnummer: YYYYMMDD-XXXX (t.ex. 19850315-1234)</p>
          <p>Hyresobjekt: XXX-XXX-XX-XXX (t.ex. 705-011-03-1234)</p>
        </div>
      </CardContent>
    </Card>
  )
}
