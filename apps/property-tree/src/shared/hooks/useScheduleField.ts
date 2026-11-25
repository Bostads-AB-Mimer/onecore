import { useState } from 'react'

import { useScheduleConfig } from '@/entities/dispatch'

import type { ScheduleConfig } from '@/services/api/core/communicationService'

import { getNextOpenSlot, validateScheduleDate } from '@/shared/lib/schedule'

export interface ScheduleFieldState {
  /** Rules from the service; undefined while loading or on error. */
  config: ScheduleConfig | undefined
  /** False while the config loads or when scheduling is off: hide the field. */
  enabled: boolean
  /** The rules could not be fetched: show a hint, not "scheduling off". */
  isError: boolean
  isScheduling: boolean
  sendAt: Date | null
  setSendAt: (value: Date | null) => void
  /** Validation error for the current value; null when usable (or not scheduling). */
  error: string | null
  /** Checkbox handler; suggests the first open slot about an hour ahead on first enable. */
  toggle: (checked: boolean) => void
  /** ISO instant to send to the API; undefined when not scheduling. */
  sendAtIso: () => string | undefined
  reset: () => void
}

/**
 * State + rules for the "Schemalägg utskick" field in the send modals
 * (checkbox + date/time slot picker validated against the service's rules).
 * Available in both bulk and single mode — single sends also go through
 * the bulk endpoints.
 */
export function useScheduleField(): ScheduleFieldState {
  const { data: config, isError } = useScheduleConfig()
  const [isScheduling, setIsScheduling] = useState(false)
  const [sendAt, setSendAt] = useState<Date | null>(null)

  const enabled = config?.enabled === true
  const error =
    isScheduling && config ? validateScheduleDate(sendAt, config) : null

  const toggle = (checked: boolean) => {
    setIsScheduling(checked)
    if (checked && !sendAt && config) {
      setSendAt(getNextOpenSlot(new Date(Date.now() + 3600_000), config))
    }
  }

  const sendAtIso = () =>
    isScheduling && sendAt ? sendAt.toISOString() : undefined

  const reset = () => {
    setIsScheduling(false)
    setSendAt(null)
  }

  return {
    config,
    enabled,
    isError,
    isScheduling,
    sendAt,
    setSendAt,
    error,
    toggle,
    sendAtIso,
    reset,
  }
}
