import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { Tenant, Lease } from '@/services/api/leaseSearchService'
import { fetchTenantAndLeasesByPnr } from '@/services/api/leaseSearchService'

interface SearchTenantProps {
  onTenantFound: (tenant: Tenant, contracts: Lease[]) => void
}

const isValidPnr = (pnr: string) => /^(?:\d{6}|\d{8})-?\d{4}$/.test(pnr.trim())

export function SearchTenant({ onTenantFound }: SearchTenantProps) {
  const [personnummer, setPersonnummer] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSearch = async () => {
    const pnr = personnummer.trim()
    if (!isValidPnr(pnr)) {
      toast({
        title: 'Ogiltigt personnummer',
        description: 'Ange format YYYYMMDD-XXXX',
        variant: 'destructive',
      })
      return
    }

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
      onTenantFound(result.tenant, result.contracts)
    } catch (e: Error) {
      toast({
        title: 'Kunde inte söka',
        description: e.message ?? 'Okänt fel',
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
          Sök hyresgäst
        </CardTitle>
        <CardDescription>
          Ange personnummer för att hitta hyresgäst och visa kontrakt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="YYYYMMDD-XXXX"
            value={personnummer}
            onChange={(e) => setPersonnummer(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={handleSearch} className="gap-2" disabled={loading}>
            <Search className="h-4 w-4" />
            {loading ? 'Söker…' : 'Sök'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Format: YYYYMMDD-XXXX (t.ex. 19850315-1234)
        </p>
      </CardContent>
    </Card>
  )
}
