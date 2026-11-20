import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

/** Why a list request failed, as far as the user needs to know. */
export type ListFailure = 'forbidden' | 'warming' | 'failed'

type Props = {
  /** What the list holds, in plural: "hemförsäkringar". */
  subject: string
  /** Retrying while the backend loads its cache for the first time. */
  isWarming: boolean
  isLoading: boolean
  isFetching: boolean
  failure?: ListFailure
  isEmpty: boolean
  children: ReactNode
}

const failureText = (failure: ListFailure, subject: string) => {
  if (failure === 'forbidden') return `Du har inte behörighet att se ${subject}`
  if (failure === 'warming')
    return 'Systemet tar längre tid än väntat att starta — försök igen om en stund'
  return `Ett fel uppstod vid hämtning av ${subject}`
}

/** The states of a list page: starting up, loading, failed, empty, or the
 * list itself with a searching overlay while it refetches. */
export function ListQueryState({
  subject,
  isWarming,
  isLoading,
  isFetching,
  failure,
  isEmpty,
  children,
}: Props) {
  if (isWarming)
    return (
      <div className="text-center py-8 text-muted-foreground">
        Systemet startar upp, försöker igen automatiskt...
      </div>
    )
  if (isLoading)
    return (
      <div className="text-center py-8 text-muted-foreground">
        Laddar {subject}...
      </div>
    )
  if (failure)
    return (
      <div className="text-center py-8 text-destructive">
        {failureText(failure, subject)}
      </div>
    )
  if (isEmpty)
    return (
      <div className="text-center py-8 text-muted-foreground">
        {isFetching ? 'Söker...' : `Inga ${subject} hittades`}
      </div>
    )

  return (
    <div className="relative">
      {isFetching && (
        <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10 rounded-md">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Söker...</span>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
