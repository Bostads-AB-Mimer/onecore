import { useMatches } from 'react-router-dom'

import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'

interface RouteHandle {
  title?: string
  /**
   * The page sets document.title itself (e.g. from data it loads), so this
   * component leaves it alone on that route.
   */
  ownsDocumentTitle?: boolean
}

const handleOf = (match: { handle: unknown } | undefined) =>
  match?.handle as RouteHandle | undefined

export function RouteDocumentTitle() {
  const matches = useMatches()

  const ownsDocumentTitle =
    handleOf(matches[matches.length - 1])?.ownsDocumentTitle === true
  const title = handleOf(
    matches
      .slice()
      .reverse()
      .find((m) => handleOf(m)?.title)
  )?.title

  // Keyed on the resolved title rather than the matches, which change on
  // every navigation, hash-only ones included.
  useDocumentTitle(title, { enabled: !ownsDocumentTitle })

  return null
}
