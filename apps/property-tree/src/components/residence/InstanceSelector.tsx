import { useState } from 'react'
import { Label } from '@/components/ui/v2/Label'
import { Input } from '@/components/ui/Input'
import { useQuery } from '@tanstack/react-query'
import { componentService } from '@/services/api/core/componentService'
import { useDebounce } from '@/components/hooks/useDebounce'
import type { ComponentInstance } from '@/services/types'

interface InstanceSelectorProps {
  modelId: string
  value: string // Selected instance ID
  onChange: (instanceId: string, instance: ComponentInstance | undefined) => void
  error?: string
}

export const InstanceSelector = ({
  modelId,
  value,
  onChange,
  error,
}: InstanceSelectorProps) => {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  // Minimum search length to trigger query
  const MIN_SEARCH_LENGTH = 2
  const shouldSearch = debouncedSearch.trim().length >= MIN_SEARCH_LENGTH

  // Query with backend search - only enabled when search meets minimum length
  const { data: instances = [], isLoading, isError } = useQuery({
    queryKey: ['instances', 'uninstalled', modelId, debouncedSearch],
    queryFn: () =>
      componentService.getUninstalledInstances(modelId, debouncedSearch),
    enabled: !!modelId && shouldSearch,
  })

  const selectedInstance = instances.find((inst) => inst.id === value)

  return (
    <div className="space-y-2">
      <Label htmlFor="instance-search">Välj instans</Label>

      <div className="relative">
        <Input
          id="instance-search"
          type="text"
          placeholder="Sök efter serienummer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        {isLoading && (
          <div className="absolute right-3 top-2">
            <div className="h-5 w-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          Kunde inte ladda instanser. Försök igen.
        </p>
      )}

      <div className="border rounded-md max-h-60 overflow-y-auto">
        {!shouldSearch ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Skriv minst {MIN_SEARCH_LENGTH} tecken för att söka efter
            serienummer
          </div>
        ) : instances.length === 0 && !isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Inga instanser hittades för "{debouncedSearch}"
          </div>
        ) : (
          <div className="divide-y">
            {instances.map((instance) => (
              <button
                key={instance.id}
                type="button"
                onClick={() => {
                  onChange(instance.id, instance)
                  setSearch('')
                }}
                className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors ${
                  value === instance.id ? 'bg-accent' : ''
                }`}
              >
                <div className="text-sm font-medium">
                  {instance.serialNumber}
                </div>
                <div className="text-xs text-muted-foreground">
                  Garanti: {instance.warrantyMonths} mån | Pris:{' '}
                  {instance.priceAtPurchase} kr
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedInstance && (
        <div className="mt-2 p-3 bg-accent rounded-md">
          <p className="text-sm font-medium">Vald instans:</p>
          <p className="text-sm text-muted-foreground">
            {selectedInstance.serialNumber}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  )
}
