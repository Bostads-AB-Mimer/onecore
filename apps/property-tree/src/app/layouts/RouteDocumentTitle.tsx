import { useEffect } from 'react'
import { useMatches } from 'react-router-dom'

interface RouteHandle {
  title?: string
}

export function RouteDocumentTitle() {
  const matches = useMatches()

  useEffect(() => {
    const match = matches
      .slice()
      .reverse()
      .find((m) => (m.handle as RouteHandle)?.title)

    const title = (match?.handle as RouteHandle)?.title

    if (title) {
      document.title = `${title} | ONECore`
    } else {
      document.title = 'ONECore'
    }
  }, [matches])

  return null
}
