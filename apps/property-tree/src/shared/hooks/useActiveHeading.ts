import { useEffect, useState } from 'react'

/** Slack for rounding when comparing scroll position to page height. */
const SCROLL_BOTTOM_EPSILON_PX = 2

interface ActiveIdInput {
  /** All tracked ids, in document order. */
  ids: string[]
  /** Ids currently intersecting the viewport. */
  visible: ReadonlySet<string>
  scrollY: number
  innerHeight: number
  scrollHeight: number
}

/**
 * The id to highlight, or null when nothing changed and the previous one
 * should stay. Picks by document order rather than by measured position, and
 * pins the last id once the page is scrolled to the bottom — the last section
 * is often too short to ever become the topmost intersecting one.
 */
export function resolveActiveId({
  ids,
  visible,
  scrollY,
  innerHeight,
  scrollHeight,
}: ActiveIdInput): string | null {
  if (ids.length === 0) return null
  if (
    scrollHeight > innerHeight &&
    scrollY + innerHeight >= scrollHeight - SCROLL_BOTTOM_EPSILON_PX
  ) {
    return ids[ids.length - 1]
  }
  return ids.find((id) => visible.has(id)) ?? null
}

/**
 * Track which of the given element ids is currently in view, for a table of
 * contents that highlights the active section while the page scrolls.
 */
export function useActiveHeading(
  ids: string[],
  rootMargin = '0px 0px -70% 0px'
) {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    if (ids.length === 0 || typeof IntersectionObserver === 'undefined') return

    const visible = new Set<string>()

    const update = () => {
      const next = resolveActiveId({
        ids,
        visible,
        scrollY: window.scrollY,
        innerHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
      })
      if (next) setActiveId(next)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible.add(entry.target.id)
          } else {
            visible.delete(entry.target.id)
          }
        })
        update()
      },
      { rootMargin, threshold: 0 }
    )

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    elements.forEach((element) => observer.observe(element))

    window.addEventListener('scroll', update, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update)
    }
  }, [ids, rootMargin])

  return activeId
}
