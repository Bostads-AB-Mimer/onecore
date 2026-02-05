import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/KeyLoan': 'Utlåning',
  '/key-loans': 'Nyckellån',
  '/maintenance-keys': 'Entreprenör',
  '/key-bundles': 'Nyckelsamlingar',
  '/Keys': 'Nycklar',
  '/key-systems': 'Låssystem',
  '/activity-log': 'Händelselogg',
}

export function PageTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    const title =
      pageTitles[pathname] ??
      Object.entries(pageTitles).find(([path]) =>
        pathname.startsWith(path + '/')
      )?.[1]

    if (title) {
      document.title = `${title} | Nyckelportalen`
    } else {
      document.title = 'Nyckelportalen'
    }
  }, [pathname])

  return null
}
