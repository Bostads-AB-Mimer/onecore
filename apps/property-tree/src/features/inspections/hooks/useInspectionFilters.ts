import { useMemo, useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'

type Inspection = components['schemas']['Inspection']

export function useInspectionFilters(inspections: Inspection[]) {
  const [openInspectorDropdown, setOpenInspectorDropdown] = useState(false)
  const [openAddressDropdown, setOpenAddressDropdown] = useState(false)

  // Extract unique values for dropdowns
  const uniqueInspectors = useMemo(() => {
    const inspectors = new Set<string>()
    inspections.forEach((i) => {
      if (i.inspector) inspectors.add(i.inspector)
    })
    return Array.from(inspectors).sort()
  }, [inspections])

  const uniqueAddresses = useMemo(() => {
    const addresses = new Set(
      inspections.map((i) => i.address || '').filter(Boolean)
    )
    return Array.from(addresses).sort()
  }, [inspections])

  return {
    openInspectorDropdown,
    setOpenInspectorDropdown,
    openAddressDropdown,
    setOpenAddressDropdown,
    uniqueInspectors,
    uniqueAddresses,
  }
}
