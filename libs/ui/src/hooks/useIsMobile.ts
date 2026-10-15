import { useCallback, useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768
const SMALL_MOBILE_BREAKPOINT = 480

// Read mql.matches instead of window.innerWidth: innerWidth can report a
// stale value during mobile page load, and the change event only fires when
// the viewport crosses the breakpoint, so a bad first sample would stick.
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query]
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}

export function useIsSmallMobile() {
  return useMediaQuery(`(max-width: ${SMALL_MOBILE_BREAKPOINT - 1}px)`)
}
