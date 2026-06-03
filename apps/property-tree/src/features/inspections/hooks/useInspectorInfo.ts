import { useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'

import { type Checklist, CHECKLIST_DEFAULT } from '../constants/checklist'

type Inspection = components['schemas']['InternalInspection']

export interface InspectorInfo {
  inspectorName: string
  inspectionTime: string
  needsMasterKey: boolean
  isFurnished: boolean
  isTenantPresent: boolean
  isNewTenantPresent: boolean
  checklist: Checklist
}

export interface UseInspectorInfoReturn extends InspectorInfo {
  setInspectorName: (name: string) => void
  setInspectionTime: (time: string) => void
  setNeedsMasterKey: (value: boolean) => void
  setIsFurnished: (value: boolean) => void
  setIsTenantPresent: (value: boolean) => void
  setIsNewTenantPresent: (value: boolean) => void
  setChecklistItem: (key: keyof Checklist, value: boolean) => void
  isValid: boolean
  isChecklistComplete: boolean
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

  // Tenant presence is now captured during the inspection (MIM-1818) rather
  // than at create time. Hydrate from the persisted inspection so reopening
  // a draft restores the inspector's previous choice.
  const [isTenantPresent, setIsTenantPresent] = useState(
    existingInspection?.isTenantPresent ?? false
  )
  const [isNewTenantPresent, setIsNewTenantPresent] = useState(
    existingInspection?.isNewTenantPresent ?? false
  )

  // The "Kontrollfrågor" safety checklist. Defaults to all-false; hydrated
  // from the saved draft when reopening.
  const [checklist, setChecklist] = useState<Checklist>(() => ({
    ...CHECKLIST_DEFAULT,
    ...(existingInspection?.checklist ?? {}),
  }))

  const setChecklistItem = (key: keyof Checklist, value: boolean) => {
    setChecklist((prev) => ({ ...prev, [key]: value }))
  }

  const isChecklistComplete =
    checklist.groundFaultBreaker &&
    checklist.smokeDetector &&
    checklist.electricalSchema &&
    checklist.electricalSystem

  // Validation: inspector name is required
  const isValid = Boolean(inspectorName.trim() && inspectionTime)

  return {
    inspectorName,
    inspectionTime,
    needsMasterKey,
    isFurnished,
    isTenantPresent,
    isNewTenantPresent,
    checklist,
    setInspectorName,
    setInspectionTime,
    setNeedsMasterKey,
    setIsFurnished,
    setIsTenantPresent,
    setIsNewTenantPresent,
    setChecklistItem,
    isValid,
    isChecklistComplete,
  }
}
