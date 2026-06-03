import { useMutation } from '@tanstack/react-query'

import { resolve } from '@/shared/lib/env'

const CORE_API_URL = resolve('VITE_CORE_API_URL', 'http://localhost:5010')

type ExportArgs = {
  propertyName: string
  buildingCode?: string
}

async function fetchKeysExport({
  propertyName,
  buildingCode,
}: ExportArgs): Promise<Blob> {
  const params = new URLSearchParams()
  params.set('property', propertyName)
  if (buildingCode) params.set('buildingCode', buildingCode)

  const response = await fetch(
    `${CORE_API_URL}/leases/keys-export?${params.toString()}`,
    { credentials: 'include' }
  )
  if (!response.ok) {
    throw new Error(`Export misslyckades: ${response.statusText}`)
  }
  return response.blob()
}

export function usePropertyKeysExport() {
  return useMutation({
    mutationFn: async (args: ExportArgs) => {
      const blob = await fetchKeysExport(args)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().split('T')[0]
      const suffix = args.buildingCode
        ? `${args.propertyName}-${args.buildingCode}`
        : args.propertyName
      a.download = `nycklar-${suffix}-${date}.xlsx`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        a.remove()
      }, 1000)
    },
  })
}
