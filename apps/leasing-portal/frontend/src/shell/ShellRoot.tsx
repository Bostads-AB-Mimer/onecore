import { useRequireUser } from '@onecore/auth'

import { LeasingHostProvider } from '../host/LeasingHostProvider'
import { authConfig } from './authConfig'
import { ShellLayout } from './ShellLayout'

/** Requires a logged-in user, then hosts the leasing pages inside the shell layout. */
export function ShellRoot() {
  const user = useRequireUser()

  if (user.tag === 'error' && user.error === 'unavailable') {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Tjänsten är inte tillgänglig just nu. Sidan försöker igen automatiskt.
      </div>
    )
  }

  if (user.tag === 'error' && user.error === 'unknown') {
    return (
      <div className="flex h-screen items-center justify-center text-destructive">
        Okänt fel, kontakta support.
      </div>
    )
  }

  // Loading, or unauthenticated while useRequireUser redirects to login.
  if (user.tag !== 'success') {
    return (
      <div className="flex h-screen items-center justify-center">Laddar...</div>
    )
  }

  return (
    <LeasingHostProvider
      bffUrl={authConfig.bffUrl}
      coreUrl={authConfig.coreUrl}
      user={user.user}
    >
      <ShellLayout user={user.user} />
    </LeasingHostProvider>
  )
}
