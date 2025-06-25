import React from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { match, P } from 'ts-pattern'

import { authConfig } from '@/auth-config'
import { POST } from '@/services/api/core/base-api'

type AuthCallbackState =
  | { tag: 'loading' }
  | { tag: 'success' }
  | { tag: 'error'; error: string }

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [state, setState] = React.useState<AuthCallbackState>({
    tag: 'loading',
  })

  const code = searchParams.get('code')

  const lastKnownClientPath = match(searchParams.get('state'))
    .with(P.string, decodeURIComponent)
    .otherwise(() => '/')

  const requested = React.useRef(false)

  React.useEffect(() => {
    if (!code) {
      return setState({
        tag: 'error',
        error: 'Ingen autentiseringskod hittades i URL:en.',
      })
    } else {
      if (!requested.current) {
        // Prevent duplicate requests caused by <StrictMode/> in development ¯\_(ツ)_/¯
        requested.current = true
        POST('/auth/callback', {
          credentials: 'include',
          body: {
            code,
            redirectUri: authConfig.redirectUri,
          },
        })
          .then(() => setState({ tag: 'success' }))
          .catch((err) => {
            console.error(err)
            setState({
              tag: 'error',
              error: 'Ett fel uppstod vid autentisering.',
            })
          })
      }
    }
  }, [code, navigate])

  return match(state)
    .with({ tag: 'loading' }, () => (
      <div className="flex items-center justify-center h-screen">
        Autentiserar...
      </div>
    ))
    .with({ tag: 'error' }, (e) => (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-red-500 mb-4">{e.error}</div>
        <button
          onClick={() => (window.location.href = '/')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Gå tillbaka
        </button>
      </div>
    ))
    .with({ tag: 'success' }, () => (
      <div className="flex items-center justify-center h-screen">
        <Navigate to={lastKnownClientPath} />
      </div>
    ))
    .exhaustive()
}
