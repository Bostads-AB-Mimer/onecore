import { RefObject, useEffect, useRef } from 'react'

/**
 * Calls `handler` on a pointer press outside `ref`. Uses `pointerdown` so it
 * covers mouse and touch (incl. iOS Safari) and fires before focus changes —
 * unlike blur detection, dismissing the keyboard doesn't count as "outside".
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: () => void,
  enabled = true
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return

    const onPointerDown = (event: PointerEvent) => {
      const el = ref.current
      if (el && !el.contains(event.target as Node)) {
        handlerRef.current()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [ref, enabled])
}
