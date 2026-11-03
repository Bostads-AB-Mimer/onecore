import { useEffect, useRef } from 'react'

/**
 * Revokes object URLs once they leave `urls` (e.g. a pending image that was
 * removed or replaced by its upload) and all remaining ones on unmount.
 */
export function useRevokeObjectUrls(urls: readonly string[]) {
  const tracked = useRef(new Set<string>())
  // Joined so the effect only runs when the set of URLs actually changes.
  const key = urls.join('\n')

  useEffect(() => {
    const current = new Set(key ? key.split('\n') : [])
    tracked.current.forEach((url) => {
      if (!current.has(url)) URL.revokeObjectURL(url)
    })
    tracked.current = current
  }, [key])

  useEffect(
    () => () => {
      tracked.current.forEach((url) => URL.revokeObjectURL(url))
      tracked.current = new Set()
    },
    []
  )
}
