import React from 'react'
import { Outlet } from 'react-router-dom'
import { match } from 'ts-pattern'

import { useAuth } from '@/features/auth'
import { useUser } from '@/entities/user'

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
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
    .with({ tag: 'error', error: 'unauthenticated' }, () => (
      <div className="flex items-center justify-center h-screen">Laddar...</div>
    ))
    .with({ tag: 'error', error: 'unknown' }, () => (
      // Only show "Okänt fel" for actual unknown errors
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">Okänt fel, kontakta support.</div>
      </div>
    ))
    .with({ tag: 'success' }, () => <>{children ?? <Outlet />}</>)
    .exhaustive()
}
