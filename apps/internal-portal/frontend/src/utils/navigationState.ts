import type { Location } from 'react-router-dom'

// Router state passed along by links that lead into an editor, so the
// editor's "back" button can return the user to the view they came from.
export type FromState = { from?: string }

// Path (including query params, so filters in the URL survive) to store as
// the origin of a navigation.
export const currentPath = (location: Pick<Location, 'pathname' | 'search'>) =>
  location.pathname + location.search

// Reads the origin from router state; falls back when the state is missing
// (direct link, new tab, menu navigation) or is not an in-app path.
export const getReturnTo = (state: unknown, fallback: string): string => {
  if (typeof state !== 'object' || state === null) return fallback

  const { from } = state as FromState
  return typeof from === 'string' && from.startsWith('/') ? from : fallback
}
