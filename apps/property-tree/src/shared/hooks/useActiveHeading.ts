import { useEffect, useState } from 'react'

/**
 * Track which of the given element ids is currently in view, for a table of
 * contents that highlights the active section while the page scrolls. The
 * topmost intersecting element wins.
 */
export function useActiveHeading(
  ids: string[],
  rootMargin = '0px 0px -70% 0px'
) {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    if (ids.length === 0 || typeof IntersectionObserver === 'undefined') return

    const visible = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.boundingClientRect.top)
          } else {
            visible.delete(entry.target.id)
          }
        })
        if (visible.size === 0) return
        const [topmost] = [...visible.entries()].sort((a, b) => a[1] - b[1])
        setActiveId(topmost[0])
      },
      { rootMargin, threshold: 0 }
    )

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    elements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [ids, rootMargin])

  return activeId
}
