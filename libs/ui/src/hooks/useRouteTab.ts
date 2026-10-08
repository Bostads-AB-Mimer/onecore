import { useLocation, useParams } from 'react-router-dom'

/**
 * Resolves the active tab from an optional `:tab?` route segment.
 * Unknown or missing segments resolve to `defaultTab`; the URL is left as is.
 */
export function useRouteTab<T extends string>(
  tabs: readonly { value: T; disabled?: boolean }[],
  defaultTab: NoInfer<T>
): { value: T; basePath: string } {
  const { tab } = useParams<{ tab?: string }>()
  const { pathname } = useLocation()

  const known = tabs.some((t) => t.value === tab && !t.disabled)
  const value = known ? (tab as T) : defaultTab
  // The param is decoded but the pathname is not, so cut at the last slash.
  const trimmed = pathname.replace(/\/+$/, '')
  const basePath = tab ? trimmed.slice(0, trimmed.lastIndexOf('/')) : trimmed

  return { value, basePath }
}
