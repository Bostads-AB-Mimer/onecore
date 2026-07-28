import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Manual removal of recipients (the ✕ on recipient chips) for the bulk send
 * modals. Removal state resets whenever the modal opens or closes, so a
 * dismissed modal never leaks removals into the next send.
 */
export function useRemovableRecipients<T extends { id: string }>(
  recipients: T[],
  open: boolean
) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Avoid a pointless allocation + re-render when nothing was removed
    setRemovedIds((prev) => (prev.size === 0 ? prev : new Set()))
  }, [open])

  // Keep the input identity when nothing was removed so memoized consumers
  // (e.g. the chip list) don't re-render for free
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
