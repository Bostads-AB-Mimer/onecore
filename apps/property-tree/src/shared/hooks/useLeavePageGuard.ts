import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

interface ShouldBlockNavigationParams {
  /** Whether leaving the page should be confirmed right now. */
  when: boolean
  /** Set by the page to let one programmatic navigation through. */
  allowNext: boolean
  currentPathname: string
  nextPathname: string
}

/**
 * Only a change of page is blocked. A search-param change on the same page
 * (e.g. clearing a prefill param) stays allowed.
 */
export function shouldBlockNavigation({
  when,
  allowNext,
  currentPathname,
  nextPathname,
}: ShouldBlockNavigationParams): boolean {
  if (allowNext) return false
  return when && currentPathname !== nextPathname
}

/**
 * Asks for confirmation before in-app navigation, reload or tab close while
 * `when` is true. Render `LeavePageDialog` with the returned blocker.
 *
 * Set `allowNextNavigation.current = true` right before a programmatic
 * redirect that should pass even though `when` is still true in the
 * blocker's closure (e.g. redirect after save).
 */
export function useLeavePageGuard(when: boolean) {
  const allowNextNavigation = useRef(false)

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const allowNext = allowNextNavigation.current
    allowNextNavigation.current = false
    return shouldBlockNavigation({
      when,
      allowNext,
      currentPathname: currentLocation.pathname,
      nextPathname: nextLocation.pathname,
    })
  })

  useEffect(() => {
    if (!when) return
    // The browser shows its own generic confirmation; the text can't be set.
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])

  return { blocker, allowNextNavigation }
}
