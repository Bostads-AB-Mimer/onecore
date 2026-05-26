import { useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'

type Inspection = components['schemas']['InternalInspection']

export interface InspectorInfo {
  inspectorName: string
  inspectionTime: string
  needsMasterKey: boolean
  isFurnished: boolean
}

export interface UseInspectorInfoReturn extends InspectorInfo {
  setInspectorName: (name: string) => void
  setInspectionTime: (time: string) => void
  setNeedsMasterKey: (value: boolean) => void
  setIsFurnished: (value: boolean) => void
  isValid: boolean
}

export function useInspectorInfo(
  existingInspection?: Inspection
): UseInspectorInfoReturn {
  const [inspectorName, setInspectorName] = useState(
    existingInspection?.inspector || ''
  )

  const [inspectionTime, setInspectionTime] = useState(() => {
    if (existingInspection?.date) {
      // Try to extract time from existing inspection
      return '10:00' // Default time if not available
    }
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  })

  const [needsMasterKey, setNeedsMasterKey] = useState(
    Boolean(existingInspection?.masterKeyAccess)
  )

  // Default true — apartments are furnished at inspection time in ~99% of
  // cases. The inspector flips this off only for the rare empty-apartment
  // case. Mirrors the create-dialog seed.
  const [isFurnished, setIsFurnished] = useState(
    existingInspection?.isFurnished ?? true
  )

  // Validation: inspector name is required
  const isValid = Boolean(inspectorName.trim() && inspectionTime)

  return {
    inspectorName,
    inspectionTime,
    needsMasterKey,
    isFurnished,
    setInspectorName,
    setInspectionTime,
    setNeedsMasterKey,
    setIsFurnished,
    isValid,
  }
}
