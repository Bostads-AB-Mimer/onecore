import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { LeasingHostProvider } from '../host/LeasingHostProvider'
import { useAuth } from './auth/useAuth'
import { useUser } from './auth/useUser'
import { authConfig } from './authConfig'
import { ShellLayout } from './ShellLayout'

/** Requires a logged-in user, then hosts the leasing pages inside the shell layout. */
export function ShellRoot() {
  const { login } = useAuth()
  const user = useUser()
  const location = useLocation()
  // login() navigates away; fire it once even though the effect re-runs on each render.
  const redirecting = useRef(false)

  useEffect(() => {
    if (
      user.tag === 'error' &&
      user.error === 'unauthenticated' &&
      !redirecting.current
    ) {
      redirecting.current = true
      login(`${location.pathname}${location.search}`)
    }
  }, [login, user, location.pathname, location.search])

  if (user.tag === 'error' && user.error !== 'unauthenticated') {
    return (
      <div className="flex h-screen items-center justify-center text-destructive">
        Okänt fel, kontakta support.
      </div>
    )
  }

  if (user.tag !== 'success') {
    return (
      <div className="flex h-screen items-center justify-center">Laddar...</div>
    )
  }

  return (
    <LeasingHostProvider
      bffUrl={authConfig.bffUrl}
      coreUrl={authConfig.apiUrl}
      user={user.user}
    >
      <ShellLayout user={user.user} />
    </LeasingHostProvider>
  )
}
