import { useState } from 'react'

import {
  getScheduleBounds,
  toDatetimeLocalValue,
  validateScheduleInput,
} from '@/shared/lib/schedule'

export interface ScheduleFieldState {
  isScheduling: boolean
  sendAtLocal: string
  setSendAtLocal: (value: string) => void
  /** Validation error for the current value; null when usable (or not scheduling). */
  error: string | null
  /** min/max for the datetime-local input, per the channel cap. */
  bounds: { min: string; max: string }
  /** Checkbox handler; suggests one hour ahead on first enable. */
  toggle: (checked: boolean) => void
  /** ISO instant to send to the API; undefined when not scheduling. */
  sendAtIso: () => string | undefined
  reset: () => void
}

/**
 * State + rules for the "Schemalägg utskick" field in the send modals
 * (checkbox + datetime-local input validated against the channel cap).
 * Available in both bulk and single mode — single sends also go through
 * the bulk endpoints.
 */
export function useScheduleField(maxDaysAhead: number): ScheduleFieldState {
  const [isScheduling, setIsScheduling] = useState(false)
  const [sendAtLocal, setSendAtLocal] = useState('')

  const error = isScheduling
    ? validateScheduleInput(sendAtLocal, maxDaysAhead)
    : null
  const bounds = getScheduleBounds(maxDaysAhead)

  const toggle = (checked: boolean) => {
    setIsScheduling(checked)
    if (checked && !sendAtLocal) {
      // Suggest one hour ahead so the field starts valid.
      setSendAtLocal(toDatetimeLocalValue(new Date(Date.now() + 3600_000)))
    }
  }

  // datetime-local is parsed as local time; the API gets a UTC instant.
  const sendAtIso = () =>
    isScheduling ? new Date(sendAtLocal).toISOString() : undefined

  const reset = () => {
    setIsScheduling(false)
    setSendAtLocal('')
  }

  return {
    isScheduling,
    sendAtLocal,
    setSendAtLocal,
    error,
    bounds,
    toggle,
    sendAtIso,
    reset,
  }
}
