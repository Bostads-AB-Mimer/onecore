import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '@onecore/ui'

import { authConfig } from '../authConfig'

type CallbackState =
  { tag: 'loading' } | { tag: 'success' } | { tag: 'error'; error: string }

export function AuthCallback() {
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<CallbackState>({ tag: 'loading' })

  const code = searchParams.get('code')
  const returnTo = searchParams.get('state') ?? '/'
  // Guards against the double effect run under <StrictMode/> in development.
  const requested = useRef(false)

  useEffect(() => {
    if (!code) {
      setState({ tag: 'error', error: 'Ingen autentiseringskod hittades.' })
      return
    }
    if (requested.current) return
    requested.current = true

    fetch(`${authConfig.apiUrl}/auth/callback`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri: authConfig.redirectUri }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`callback ${res.status}`)
        setState({ tag: 'success' })
      })
      .catch(() => {
        setState({ tag: 'error', error: 'Ett fel uppstod vid inloggning.' })
      })
  }, [code])

  if (state.tag === 'success') return <Navigate to={returnTo} replace />

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      {state.tag === 'loading' ? (
        <p>Loggar in...</p>
      ) : (
        <>
          <p className="text-destructive">{state.error}</p>
          <Button onClick={() => (window.location.href = '/')}>
            Gå tillbaka
          </Button>
        </>
      )}
    </div>
  )
}
