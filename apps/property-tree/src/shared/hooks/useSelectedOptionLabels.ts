import { useCallback, useEffect, useRef, useState } from 'react'

import type { SearchFilterOption } from '@/shared/ui/filters/types'

/** Lookup state of a selected value that has no label yet */
type LabelStatus = 'loading' | 'notFound' | 'failed'

const LABEL_STATUS_TEXT: Record<LabelStatus, string> = {
  loading: 'Laddar…',
  notFound: 'Okänt namn',
  failed: 'Kunde inte hämta namn',
}

/**
 * Keeps display labels for selected filter values. Labels come from picked
 * options (`remember`) or, for values with none (e.g. from a saved link),
 * from `resolveLabels`. Without `resolveLabels`, a value is shown as is.
 * `resolveLabels` must be a stable function.
 */
export function useSelectedOptionLabels(
  selectedValues: string[],
  resolveLabels?: (values: string[]) => Promise<SearchFilterOption[]>
) {
  const [labels, setLabels] = useState<Map<string, string>>(new Map())
  const [statuses, setStatuses] = useState<Map<string, LabelStatus>>(new Map())
  // Values whose label is known or has been requested; each is looked up once until forgotten
  const requestedRef = useRef<Set<string>>(new Set())
  // Bumped by retryFailed so the lookup effect runs again for the values it released
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!resolveLabels) return
    const requested = requestedRef.current
    const values = selectedValues.filter((v) => !requested.has(v))
    if (values.length === 0) return

    values.forEach((v) => requested.add(v))
    setStatuses((prev) => {
      const next = new Map(prev)
      values.forEach((v) => next.set(v, 'loading'))
      return next
    })

    // Set by cleanup so an answer after unmount or a selection change is dropped
    let ignore = false
    let settled = false

    const lookup = async () => {
      try {
        const options = await resolveLabels(values)
        if (ignore) return
        setLabels((prev) => {
          const next = new Map(prev)
          options.forEach((o) => next.set(o.value, o.label))
          return next
        })
        const found = new Set(options.map((o) => o.value))
        setStatuses((prev) => {
          const next = new Map(prev)
          values.forEach((v) => {
            if (found.has(v)) next.delete(v)
            else next.set(v, 'notFound')
          })
          return next
        })
      } catch (err: unknown) {
        console.error('useSelectedOptionLabels: Label lookup failed', err)
        if (ignore) return
        setStatuses((prev) => {
          const next = new Map(prev)
          values.forEach((v) => next.set(v, 'failed'))
          return next
        })
      } finally {
        settled = true
      }
    }

    lookup()

    return () => {
      ignore = true
      // Let the next run ask again for values whose answer is now dropped
      if (!settled) values.forEach((v) => requested.delete(v))
    }
  }, [selectedValues, resolveLabels, retryCount])

  /** Store the label of a value picked from search results; no lookup needed */
  const remember = useCallback((value: string, label: string) => {
    requestedRef.current.add(value)
    setLabels((prev) => new Map(prev).set(value, label))
  }, [])

  /** Drop a deselected value, so it is looked up again if it comes back (e.g. browser back) */
  const forget = useCallback((value: string) => {
    requestedRef.current.delete(value)
    setLabels((prev) => {
      const next = new Map(prev)
      next.delete(value)
      return next
    })
  }, [])

  /** Look up again the selected values whose lookup failed */
  const retryFailed = () => {
    const failed = selectedValues.filter((v) => statuses.get(v) === 'failed')
    if (failed.length === 0) return
    failed.forEach((v) => requestedRef.current.delete(v))
    setRetryCount((n) => n + 1)
  }

  const clear = useCallback(() => {
    requestedRef.current.clear()
    setLabels(new Map())
  }, [])

  const getDisplayLabel = (value: string) => {
    const label = labels.get(value)
    if (label !== undefined) return label
    const status = statuses.get(value)
    if (status) return LABEL_STATUS_TEXT[status]
    // Before the lookup effect has run, show loading rather than the raw value
    return resolveLabels ? LABEL_STATUS_TEXT.loading : value
  }

  return { getDisplayLabel, remember, forget, clear, retryFailed }
}
