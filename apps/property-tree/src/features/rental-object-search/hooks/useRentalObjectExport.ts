import { useMutation } from '@tanstack/react-query'

import type { RentalObjectType } from '@/entities/property-tree'

import { resolve } from '@/shared/lib/env'

import type { RentalObjectScopes } from '../model/scopes'

const CORE_API_URL = resolve('VITE_CORE_API_URL', 'http://localhost:5010')

interface ExportArgs {
  scopes: RentalObjectScopes
  types: RentalObjectType[]
  subtypes: string[]
}

/** The export takes the search's query verbatim, minus paging. Raw fetch, as
 * the typed client can't hand back a blob. */
async function fetchExport({ scopes, types, subtypes }: ExportArgs) {
  const params = new URLSearchParams()
  for (const [key, values] of Object.entries(scopes)) {
    for (const value of values ?? []) params.append(key, value)
  }
  for (const type of types) params.append('types', type)
  for (const subtype of subtypes) params.append('subtypes', subtype)

  const response = await fetch(
    `${CORE_API_URL}/rental-objects/search/export?${params.toString()}`,
    { credentials: 'include' }
  )
  if (!response.ok) {
    throw new Error(`Export misslyckades: ${response.statusText}`)
  }
  return response.blob()
}

export function useRentalObjectExport() {
  return useMutation({
    mutationFn: async (args: ExportArgs) => {
      const blob = await fetchExport(args)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().split('T')[0]
      a.download = `hyresobjekt-${date}.xlsx`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        a.remove()
      }, 1000)
    },
  })
}
