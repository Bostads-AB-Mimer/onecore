import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { getPageTitle } from '../utils/pageTitle'

const PageTitle = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = getPageTitle(pathname)
  }, [pathname])

  return null
}

export default PageTitle
