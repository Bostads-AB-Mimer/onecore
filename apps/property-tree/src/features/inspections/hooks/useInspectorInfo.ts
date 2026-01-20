import { useState } from 'react'
import type { components } from '@/services/api/core/generated/api-types'

type Inspection = components['schemas']['Inspection']

export interface InspectorInfo {
  inspectorName: string
  inspectionTime: string
  needsMasterKey: boolean
}

export interface UseInspectorInfoReturn extends InspectorInfo {
  setInspectorName: (name: string) => void
  setInspectionTime: (time: string) => void
  setNeedsMasterKey: (value: boolean) => void
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

  // Validation: inspector name is required
  const isValid = Boolean(inspectorName.trim() && inspectionTime)

  return {
    inspectorName,
    inspectionTime,
    needsMasterKey,
    setInspectorName,
    setInspectionTime,
    setNeedsMasterKey,
    isValid,
  }
}
