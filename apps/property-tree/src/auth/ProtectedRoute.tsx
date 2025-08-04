import React from 'react'
import { match } from 'ts-pattern'

import { useAuth } from './useAuth'
import { useUser } from './useUser'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { login } = useAuth()
  const user = useUser()

  React.useEffect(() => {
    if (user.tag === 'error' && user.error === 'unauthenticated') {
      login(location.pathname)
    }
  }, [login, user])

  return match(user)
    .with({ tag: 'loading' }, () => (
      <div className="flex items-center justify-center h-screen">Laddar...</div>
    ))
    .with({ tag: 'error' }, (e) => (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">Okänt fel, kontakta support.</div>
      </div>
    ))
    .with({ tag: 'success' }, () => <>{children}</>)
    .exhaustive()
}
