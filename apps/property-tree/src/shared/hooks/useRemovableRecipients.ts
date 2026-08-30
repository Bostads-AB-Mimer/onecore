import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Manual removal of recipients (the ✕ on chips) for the bulk send modals.
 * Removal state resets on open/close so removals never leak into the next send.
 */
export function useRemovableRecipients<T extends { id: string }>(
  recipients: T[],
  open: boolean
) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setRemovedIds((prev) => (prev.size === 0 ? prev : new Set()))
  }, [open])

  // Keeps input identity when nothing is removed, so memoized consumers skip
  const activeRecipients = useMemo(
    () =>
      removedIds.size === 0
        ? recipients
        : recipients.filter((r) => !removedIds.has(r.id)),
    [recipients, removedIds]
  )

  const removeRecipient = useCallback((id: string) => {
    setRemovedIds((prev) => new Set(prev).add(id))
  }, [])

  return {
    activeRecipients,
    removedCount: recipients.length - activeRecipients.length,
    removeRecipient,
  }
}
