import { Navigate } from 'react-router-dom'
import { useAuthCallback, type CallbackError } from '@onecore/auth'
import { Button } from '@onecore/ui'

const messages: Record<CallbackError, string> = {
  'missing-code': 'Ingen autentiseringskod hittades.',
  'state-mismatch': 'Inloggningen kunde inte verifieras. Försök logga in igen.',
  'exchange-failed': 'Ett fel uppstod vid inloggning.',
}

export function AuthCallback() {
  const state = useAuthCallback()

  if (state.tag === 'success') return <Navigate to={state.returnTo} replace />

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      {state.tag === 'loading' ? (
        <p>Loggar in...</p>
      ) : (
        <>
          <p className="text-destructive">{messages[state.error]}</p>
          <Button onClick={() => (window.location.href = '/')}>
            Gå tillbaka
          </Button>
        </>
      )}
    </div>
  )
}
