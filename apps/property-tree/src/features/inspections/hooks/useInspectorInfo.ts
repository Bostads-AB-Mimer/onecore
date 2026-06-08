import { useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'

import { type Checklist, CHECKLIST_DEFAULT } from '../constants/checklist'
import {
  INSPECTION_TYPE,
  type InspectionType,
  isValidInspectionType,
} from '../constants/inspectionTypes'

type Inspection = components['schemas']['InternalInspection']

export interface InspectorInfo {
  inspectorName: string
  inspectionTime: string
  inspectionType: InspectionType
  needsMasterKey: boolean
  isFurnished: boolean
  isTenantPresent: boolean
  isNewTenantPresent: boolean
  checklist: Checklist
}

export interface UseInspectorInfoReturn extends InspectorInfo {
  setInspectorName: (name: string) => void
  setInspectionTime: (time: string) => void
  setInspectionType: (type: InspectionType) => void
  setNeedsMasterKey: (value: boolean) => void
  setIsFurnished: (value: boolean) => void
  setIsTenantPresent: (value: boolean) => void
  setIsNewTenantPresent: (value: boolean) => void
  setChecklistItem: (key: keyof Checklist, value: boolean) => void
  isValid: boolean
  isChecklistComplete: boolean
}

const pad = (n: number) => n.toString().padStart(2, '0')

// Derives the initial Klockslag for the conduct dialog. The 5-minute granular
// fallback matches the picker's minute options — round-to-nearest avoids a
// freshly-opened dialog showing a value the user can't re-select. We treat
// *UTC* midnight as "no time set" because CreateInspectionDialog persists the
// inspection at UTC midnight (`new Date('YYYY-MM-DD').toISOString()`); a real
// scheduled time set via this picker is stored with a non-zero UTC component.
function deriveInitialTime(date: Date | string | undefined | null): string {
  if (date) {
    const d = new Date(date)
    const isCreateDialogSentinel =
      d.getUTCHours() === 0 &&
      d.getUTCMinutes() === 0 &&
      d.getUTCSeconds() === 0
    if (!Number.isNaN(d.getTime()) && !isCreateDialogSentinel) {
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
  }
  const now = new Date()
  const rounded = Math.round(now.getMinutes() / 5) * 5
  const hours = rounded === 60 ? (now.getHours() + 1) % 24 : now.getHours()
  return `${pad(hours)}:${pad(rounded % 60)}`
}

export function useInspectorInfo(
  existingInspection?: Inspection
): UseInspectorInfoReturn {
  const [inspectorName, setInspectorName] = useState(
    existingInspection?.inspector || ''
  )

  const [inspectionTime, setInspectionTime] = useState(() =>
    deriveInitialTime(existingInspection?.date)
  )

  const [inspectionType, setInspectionType] = useState<InspectionType>(() => {
    const raw = existingInspection?.type
    return raw && isValidInspectionType(raw) ? raw : INSPECTION_TYPE.MOVE_OUT
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

  // Tenant presence is captured during the conduct flow rather than at
  // create time. Hydrate from the persisted inspection so reopening a draft
  // restores the inspector's previous choice. Default true for the outgoing
  // tenant — same "common case" reasoning as isFurnished — and false for the
  // new tenant, who is almost never on-site at avflytt.
  const [isTenantPresent, setIsTenantPresent] = useState(
    existingInspection?.isTenantPresent ?? true
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
    inspectionType,
    needsMasterKey,
    isFurnished,
    isTenantPresent,
    isNewTenantPresent,
    checklist,
    setInspectorName,
    setInspectionTime,
    setInspectionType,
    setNeedsMasterKey,
    setIsFurnished,
    setIsTenantPresent,
    setIsNewTenantPresent,
    setChecklistItem,
    isValid,
    isChecklistComplete,
  }
}
