import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { componentService } from '@/services/api/core/componentService'
import type { Component } from '@/services/types'

import { useDebounce } from '@/shared/hooks/useDebounce'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'

import {
  instanceOptionDetails,
  instanceOptionTitle,
} from '../lib/instanceOption'

interface InstanceSelectorProps {
  subtypeId: string
  value: string // Selected instance ID
  onChange: (instanceId: string, instance: Component | undefined) => void
  error?: string
}

export const InstanceSelector = ({
  subtypeId,
  value,
  onChange,
  error,
}: InstanceSelectorProps) => {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  // Minimum search length before the serial number narrows the list
  const MIN_SEARCH_LENGTH = 2
  const serialSearch =
    debouncedSearch.trim().length >= MIN_SEARCH_LENGTH
      ? debouncedSearch.trim()
      : undefined

  const { data, isLoading, isError } = useQuery({
    queryKey: ['instances', 'uninstalled', subtypeId, serialSearch ?? ''],
    queryFn: () =>
      componentService.getUninstalledInstances(subtypeId, serialSearch),
    enabled: !!subtypeId,
  })
  const instances = data?.content ?? []
  const total = data?.total ?? 0

  const selectedInstance = instances.find((inst) => inst.id === value)

  return (
    <div className="space-y-2">
      <Label htmlFor="instance-search">Välj komponent</Label>

      <div className="relative">
        <Input
          id="instance-search"
          type="text"
          placeholder="Sök på serienummer..."
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
          Kunde inte ladda komponenter. Försök igen.
        </p>
      )}

      <div className="border rounded-md max-h-60 overflow-y-auto">
        {instances.length === 0 && !isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {serialSearch
              ? `Inga oinstallerade komponenter hittades för "${serialSearch}"`
              : 'Det finns inga oinstallerade komponenter av den här undertypen'}
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
                  {instanceOptionTitle(instance)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {instanceOptionDetails(instance)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {total > instances.length && (
        <p className="text-xs text-muted-foreground">
          Visar {instances.length} av {total}. Sök på serienummer för att hitta
          fler.
        </p>
      )}

      {selectedInstance && (
        <div className="mt-2 p-3 bg-accent rounded-md">
          <p className="text-sm font-medium">Vald komponent:</p>
          <p className="text-sm text-muted-foreground">
            {instanceOptionTitle(selectedInstance)}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  )
}
