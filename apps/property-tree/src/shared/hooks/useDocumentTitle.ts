import { useEffect } from 'react'

/**
 * Sets document.title to `<title> | ONECore`. Pass `enabled: false` to leave
 * the title to someone else, e.g. a page that loads its own.
 */
export function useDocumentTitle(
  title: string | undefined,
  { enabled = true }: { enabled?: boolean } = {}
) {
  useEffect(() => {
    if (!enabled) return
    document.title = title ? `${title} | ONECore` : 'ONECore'
  }, [enabled, title])
}
