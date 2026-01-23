import { useState, useMemo } from 'react'

import type { components } from '@/services/api/core/generated/api-types'

type Inspection = components['schemas']['Inspection']

export function useInspectionFilters(inspections: Inspection[]) {
  const [selectedInspector, setSelectedInspector] = useState<string>('')
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [selectedDistrict, setSelectedDistrict] = useState<string>('')
  const [selectedPriority, setSelectedPriority] = useState<string>('')
  const [openInspectorDropdown, setOpenInspectorDropdown] = useState(false)
  const [openAddressDropdown, setOpenAddressDropdown] = useState(false)
  const [openDistrictDropdown, setOpenDistrictDropdown] = useState(false)
  const [openPriorityDropdown, setOpenPriorityDropdown] = useState(false)

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

  // const uniqueDistricts = useMemo(() => {
  //   const districts = new Set(
  //     inspections.map((i) => i.district || '').filter(Boolean)
  //   )
  //   return Array.from(districts).sort()
  // }, [inspections])

  // const priorityOptions = [
  //   { value: 'avflytt', label: 'Avflytt' },
  //   { value: 'inflytt', label: 'Inflytt' },
  // ]

  const filterInspections = (inspectionsList: Inspection[]) => {
    let filtered = [...inspectionsList]

    if (selectedInspector) {
      filtered = filtered.filter((i) => i.inspector === selectedInspector)
    }
    if (selectedAddress) {
      filtered = filtered.filter((i) => i.address === selectedAddress)
    }
    // if (selectedDistrict) {
    //   filtered = filtered.filter((i) => i.district === selectedDistrict)
    // }
    // if (selectedPriority) {
    //   filtered = filtered.filter((i) => i.priority === selectedPriority)
    // }

    return filtered
  }

  const clearFilters = () => {
    setSelectedInspector('')
    setSelectedAddress('')
    // setSelectedDistrict('')
    // setSelectedPriority('')
  }

  const hasActiveFilters =
    selectedInspector || selectedAddress || selectedDistrict || selectedPriority

  return {
    selectedInspector,
    setSelectedInspector,
    selectedAddress,
    setSelectedAddress,
    selectedDistrict,
    setSelectedDistrict,
    selectedPriority,
    setSelectedPriority,
    openInspectorDropdown,
    setOpenInspectorDropdown,
    openAddressDropdown,
    setOpenAddressDropdown,
    openDistrictDropdown,
    setOpenDistrictDropdown,
    openPriorityDropdown,
    setOpenPriorityDropdown,
    uniqueInspectors,
    uniqueAddresses,
    // uniqueDistricts,
    // priorityOptions,
    filterInspections,
    clearFilters,
    hasActiveFilters,
  }
}
