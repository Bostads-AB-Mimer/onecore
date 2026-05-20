import { useCallback, useEffect, useMemo, useState } from 'react'

import { useToast } from '@/shared/hooks/useToast'

import { getAllPropertyAreas, getKvvArea, getUniqueStewards } from '../data'
import {
  AreaReassignment,
  KvvAreaInfo,
  PropertyForAdmin,
} from '../types/adminTypes'

export function useStewardAdmin(selectedCostCenter: string) {
  const { toast } = useToast()

  // Get all property areas and stewards
  const allPropertyAreas = getAllPropertyAreas()
  const allStewards = getUniqueStewards()

  // Filter by cost center
  const filteredAreas = useMemo(() => {
    if (selectedCostCenter === 'all') return allPropertyAreas
    return allPropertyAreas.filter(
      (area) => area.costCenter === selectedCostCenter
    )
  }, [allPropertyAreas, selectedCostCenter])

  // Get unique KVV areas in the selected cost center with their original stewards
  const kvvAreasInCostCenter = useMemo(() => {
    const kvvMap = new Map<
      string,
      { stewardRefNr: string; stewardName: string; stewardPhone?: string }
    >()

    filteredAreas.forEach((area) => {
      const kvvArea = area.kvvArea || getKvvArea(area.stewardRefNr)
      if (kvvArea && !kvvMap.has(kvvArea)) {
        const steward = allStewards.find((s) => s.refNr === area.stewardRefNr)
        kvvMap.set(kvvArea, {
          stewardRefNr: area.stewardRefNr,
          stewardName: steward?.name || area.stewardRefNr,
          stewardPhone: steward?.phone,
        })
      }
    })

    return kvvMap
  }, [filteredAreas, allStewards])

  // Area assignments: kvvArea -> stewardRefNr (mutable state)
  const [areaAssignments, setAreaAssignments] = useState<Map<string, string>>(
    () => new Map()
  )

  // Pending area changes
  const [pendingChanges, setPendingChanges] = useState<AreaReassignment[]>([])

  // Per-property KVV overrides (when a card is dragged to another column)
  const [propertyOverrides, setPropertyOverrides] = useState<
    Map<string, string>
  >(() => new Map())

  // Reset assignments when cost center changes
  useEffect(() => {
    const newAssignments = new Map<string, string>()
    kvvAreasInCostCenter.forEach((data, kvvArea) => {
      newAssignments.set(kvvArea, data.stewardRefNr)
    })
    setAreaAssignments(newAssignments)
    setPendingChanges([])
    setPropertyOverrides(new Map())
  }, [selectedCostCenter])

  const resolveKvvArea = useCallback(
    (area: { id: string; kvvArea?: string; stewardRefNr: string }) => {
      return (
        propertyOverrides.get(area.id) ||
        area.kvvArea ||
        getKvvArea(area.stewardRefNr)
      )
    },
    [propertyOverrides]
  )

  // Get KVV area info list (for columns/accordion)
  const kvvAreaList = useMemo((): KvvAreaInfo[] => {
    const list: KvvAreaInfo[] = []

    kvvAreasInCostCenter.forEach((originalData, kvvArea) => {
      const currentStewardRefNr =
        areaAssignments.get(kvvArea) || originalData.stewardRefNr
      const currentSteward = allStewards.find(
        (s) => s.refNr === currentStewardRefNr
      )

      const propertiesInArea = filteredAreas.filter(
        (a) => resolveKvvArea(a) === kvvArea
      )
      const uniqueProperties = new Set(
        propertiesInArea.map((p) => p.propertyCode)
      )
      const residenceCount = propertiesInArea.reduce(
        (sum, p) => sum + (p.residenceCount || 0),
        0
      )
      const parkingCount = propertiesInArea.reduce(
        (sum, p) => sum + (p.parkingCount || 0),
        0
      )
      const entranceCount = propertiesInArea.reduce(
        (sum, p) => sum + (p.entranceCount || 0),
        0
      )

      list.push({
        kvvArea,
        stewardRefNr: currentStewardRefNr,
        stewardName: currentSteward?.name || currentStewardRefNr,
        stewardPhone: currentSteward?.phone,
        propertyCount: uniqueProperties.size,
        residenceCount,
        parkingCount,
        entranceCount,
      })
    })

    return list.sort((a, b) => a.kvvArea.localeCompare(b.kvvArea))
  }, [
    kvvAreasInCostCenter,
    areaAssignments,
    filteredAreas,
    allStewards,
    resolveKvvArea,
  ])

  // Get properties grouped by KVV area
  const propertiesByKvvArea = useMemo(() => {
    const grouped = new Map<string, PropertyForAdmin[]>()

    // Initialize all KVV areas
    kvvAreaList.forEach((area) => {
      grouped.set(area.kvvArea, [])
    })

    // Group properties by their KVV area
    filteredAreas.forEach((area) => {
      const kvvArea = resolveKvvArea(area)
      if (!kvvArea) return

      const properties = grouped.get(kvvArea) || []
      properties.push({
        id: area.id,
        propertyCode: area.propertyCode,
        propertyName: area.propertyName,
        address: area.address,
        buildingType: area.buildingType,
        kvvArea: kvvArea,
        stewardRefNr: areaAssignments.get(kvvArea) || area.stewardRefNr,
        costCenter: area.costCenter,
        residenceCount: area.residenceCount,
        parkingCount: area.parkingCount,
        entranceCount: area.entranceCount,
      })
      grouped.set(kvvArea, properties)
    })

    return grouped
  }, [filteredAreas, kvvAreaList, areaAssignments, resolveKvvArea])

  // Reassign a single property to another KVV area
  const reassignProperty = useCallback(
    (propertyId: string, toKvvArea: string) => {
      setPropertyOverrides((prev) => {
        const newMap = new Map(prev)
        newMap.set(propertyId, toKvvArea)
        return newMap
      })
    },
    []
  )

  // Check if there are unsaved changes
  const isDirty = pendingChanges.length > 0

  // Reassign a KVV area to a new steward
  const reassignArea = useCallback(
    (kvvArea: string, toStewardRefNr: string) => {
      const currentStewardRefNr = areaAssignments.get(kvvArea)
      if (!currentStewardRefNr || currentStewardRefNr === toStewardRefNr) return

      const fromSteward = allStewards.find(
        (s) => s.refNr === currentStewardRefNr
      )
      const toSteward = allStewards.find((s) => s.refNr === toStewardRefNr)

      if (!fromSteward || !toSteward) return

      // Update assignment
      setAreaAssignments((prev) => {
        const newMap = new Map(prev)
        newMap.set(kvvArea, toStewardRefNr)
        return newMap
      })

      // Get original steward for this area
      const originalData = kvvAreasInCostCenter.get(kvvArea)
      const originalStewardRefNr = originalData?.stewardRefNr

      // Check if this reverts a previous change
      const existingChangeIndex = pendingChanges.findIndex(
        (c) => c.kvvArea === kvvArea
      )

      if (existingChangeIndex >= 0) {
        const existingChange = pendingChanges[existingChangeIndex]
        // If we're moving back to the original steward, remove the change
        if (originalStewardRefNr === toStewardRefNr) {
          setPendingChanges((prev) =>
            prev.filter((_, i) => i !== existingChangeIndex)
          )
          return
        }
        // Otherwise, update the existing change
        setPendingChanges((prev) =>
          prev.map((c, i) =>
            i === existingChangeIndex
              ? {
                  ...c,
                  toSteward: { refNr: toSteward.refNr, name: toSteward.name },
                  timestamp: new Date(),
                }
              : c
          )
        )
      } else {
        // Add new pending change
        setPendingChanges((prev) => [
          ...prev,
          {
            kvvArea,
            fromSteward: { refNr: fromSteward.refNr, name: fromSteward.name },
            toSteward: { refNr: toSteward.refNr, name: toSteward.name },
            timestamp: new Date(),
          },
        ])
      }
    },
    [areaAssignments, allStewards, pendingChanges, kvvAreasInCostCenter]
  )

  // Undo a specific change
  const undoChange = useCallback(
    (kvvArea: string) => {
      const change = pendingChanges.find((c) => c.kvvArea === kvvArea)
      if (!change) return

      // Revert assignment
      setAreaAssignments((prev) => {
        const newMap = new Map(prev)
        newMap.set(kvvArea, change.fromSteward.refNr)
        return newMap
      })

      // Remove from pending changes
      setPendingChanges((prev) => prev.filter((c) => c.kvvArea !== kvvArea))
    },
    [pendingChanges]
  )

  // Cancel all changes
  const cancelAllChanges = useCallback(() => {
    const originalAssignments = new Map<string, string>()
    kvvAreasInCostCenter.forEach((data, kvvArea) => {
      originalAssignments.set(kvvArea, data.stewardRefNr)
    })
    setAreaAssignments(originalAssignments)
    setPendingChanges([])
  }, [kvvAreasInCostCenter])

  // Save all changes
  const saveChanges = useCallback(() => {
    // In a real app, this would call an API
    toast({
      title: 'Ändringar sparade',
      description: `${pendingChanges.length} ${pendingChanges.length === 1 ? 'område har' : 'områden har'} fått ny ansvarig.`,
    })

    // Clear pending changes (keep assignments as they are)
    setPendingChanges([])
  }, [pendingChanges, toast])

  return {
    kvvAreaList,
    propertiesByKvvArea,
    allStewards,
    pendingChanges,
    isDirty,
    reassignArea,
    reassignProperty,
    undoChange,
    cancelAllChanges,
    saveChanges,
  }
}
