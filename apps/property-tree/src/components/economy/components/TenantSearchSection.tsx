import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TenantSearchResult, useTenantSearch } from '@/hooks/useTenantSearch'

interface TenantSearchSectionProps {
  value?: string
  tenantName?: string
  onCustomerSelect: (tenant: TenantSearchResult | null) => void
  error?: string
}

export function TenantSearchSection({
  value,
  tenantName: customerName,
  onCustomerSelect,
  error,
}: TenantSearchSectionProps) {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    showSearchResults,
    isSearching,
  } = useTenantSearch()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
  }

  const handleSelectCustomer = (tenant: TenantSearchResult) => {
    setIsOpen(false)
    onCustomerSelect(tenant)
  }

  const handleClear = () => {
    setSearchQuery('')
    onCustomerSelect(null)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2" ref={containerRef}>
        <Label htmlFor="kundnummer">Kundnr/Personnr</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="kundnummer"
            placeholder="Sök på namn, kundnr eller personnr..."
            value={searchQuery}
            onChange={(e) => {
              handleSearch(e.target.value)
              if (e.target.value.length >= 2) {
                setIsOpen(true)
              }
            }}
            onFocus={() => {
              if (searchQuery.length >= 2) {
                setIsOpen(true)
              }
            }}
            className={cn('pl-10 pr-10', error && 'border-destructive')}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {isOpen && searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
              {searchResults.map((tenant) => (
                <button
                  key={tenant.contactCode}
                  type="button"
                  onClick={() => handleSelectCustomer(tenant)}
                  className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <div className="font-medium">{tenant.fullName}</div>
                  <div className="text-sm opacity-70">
                    {tenant.contactCode} • {tenant.fullName}
                  </div>
                </button>
              ))}
            </div>
          )}

          {isOpen && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-3">
              <p className="text-sm text-muted-foreground">
                Ingen kund hittades
              </p>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="kundnamn">Kundnamn</Label>
        <Input
          id="kundnamn"
          value={customerName}
          readOnly
          disabled
          placeholder="Fylls i automatiskt"
          className="bg-muted"
        />
      </div>
    </div>
  )
}
