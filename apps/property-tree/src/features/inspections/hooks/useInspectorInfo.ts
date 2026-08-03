import { useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'

import type { InspectionSubmitData, TenantInfoCardData } from '../types/index'
import {
  type Checklist,
  CHECKLIST_DEFAULT,
  CHECKLIST_ITEMS,
} from '../constants/checklist'
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
  buildSubmitData: (tenant?: TenantInfoCardData) => InspectionSubmitData
}

const pad = (n: number) => n.toString().padStart(2, '0')

// Derives the initial Klockslag for the conduct dialog. The 5-minute granular
// fallback matches the picker's minute options — round-to-nearest avoids a
// freshly-opened dialog showing a value the user can't re-select. We treat
// *UTC* midnight as "no time set" because CreateInspectionDialog persists the
// inspection at UTC midnight (`new Date('YYYY-MM-DD').toISOString()`); a real
// scheduled time set via this picker is stored with a non-zero UTC component.
// The fallback is display-only: buildSubmitData never persists it unless the
// inspector actually edits Klockslag.
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

  const [inspectionTime, setInspectionTimeState] = useState(() =>
    deriveInitialTime(existingInspection?.date)
  )

  const [inspectionType, setInspectionTypeState] = useState<InspectionType>(
    () => {
      const raw = existingInspection?.type
      return raw && isValidInspectionType(raw) ? raw : INSPECTION_TYPE.MOVE_OUT
    }
  )

  // The picker states above hold display fallbacks (wall-clock time, coerced
  // type) when the inspection has no real stored value. Only values the
  // inspector actually edited may be persisted — otherwise a plain draft save
  // would silently overwrite the stored schedule with the fallback.
  const [hasEditedTime, setHasEditedTime] = useState(false)
  const [hasEditedType, setHasEditedType] = useState(false)

  const setInspectionTime = (time: string) => {
    setHasEditedTime(true)
    setInspectionTimeState(time)
  }

  const setInspectionType = (type: InspectionType) => {
    setHasEditedType(true)
    setInspectionTypeState(type)
  }

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
  // restores the inspector's previous choice. CreateInspectionDialog seeds
  // true for the outgoing tenant (same "common case" reasoning as isFurnished)
  // and false for the new tenant, who is almost never on-site at avflytt —
  // the fallbacks here only apply when there is no persisted inspection.
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

  const isChecklistComplete = CHECKLIST_ITEMS.every(
    (item) => checklist[item.key]
  )

  // Validation: inspector name is required
  const isValid = Boolean(inspectorName.trim() && inspectionTime)

  // Combines the existing inspection's calendar day with the picker's HH:MM.
  // We keep the day from `existingInspection.date` (set at create time) and
  // only overwrite the time, so the inspector editing Klockslag doesn't
  // accidentally re-schedule the inspection to today.
  const composeInspectionDate = (): string => {
    const base = existingInspection?.date
      ? new Date(existingInspection.date)
      : new Date()
    const [h, m] = inspectionTime.split(':').map((s) => Number(s))
    base.setHours(Number.isFinite(h) ? h : 0)
    base.setMinutes(Number.isFinite(m) ? m : 0)
    base.setSeconds(0)
    base.setMilliseconds(0)
    return base.toISOString()
  }

  // Assembles the payload both forms hand to onSave for draft saves and
  // completion. Shared here so the desktop and mobile forms can't drift.
  // `date`/`type` are omitted unless edited — the save endpoint keeps the
  // stored values for absent fields.
  const buildSubmitData = (
    tenant?: TenantInfoCardData
  ): InspectionSubmitData => ({
    needsMasterKey,
    isFurnished,
    isTenantPresent,
    isNewTenantPresent,
    checklist,
    date: hasEditedTime ? composeInspectionDate() : undefined,
    type: hasEditedType ? inspectionType : undefined,
    tenant: tenant
      ? { name: tenant.fullName ?? '', personalNumber: '' }
      : undefined,
  })

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
    buildSubmitData,
  }
}
