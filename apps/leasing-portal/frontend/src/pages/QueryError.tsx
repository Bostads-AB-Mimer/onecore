import { describeBffError } from '../api/errors'

/** Inline failure message for a page's main query, worded by describeBffError. */
export function QueryError({ error }: { error: unknown }) {
  return (
    <p role="alert" className="py-8 text-center text-destructive">
      {describeBffError(error)}
    </p>
  )
}
