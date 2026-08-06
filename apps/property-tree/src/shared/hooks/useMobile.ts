import * as React from 'react'

const MOBILE_BREAKPOINT = 768
const SMALL_MOBILE_BREAKPOINT = 480

// Read mql.matches instead of window.innerWidth: innerWidth can report a
// stale/fallback value during mobile page load, and a bad one-time sample
// would lock the app in the wrong layout until reload (the change event
// only fires when the viewport crosses the breakpoint).
function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query]
  )

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches
  )
}

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}

export function useIsSmallMobile() {
  return useMediaQuery(`(max-width: ${SMALL_MOBILE_BREAKPOINT - 1}px)`)
}
