import { useLocation, useParams } from 'react-router-dom'

/**
 * Resolves the active tab from an optional `:tab?` route segment.
 * Unknown or missing segments resolve to `defaultTab`; the URL is left as is.
 */
export function useRouteTab<T extends string>(
  tabs: readonly { value: T }[],
  defaultTab: NoInfer<T>
): { value: T; basePath: string } {
  const { tab } = useParams<{ tab?: string }>()
  const { pathname } = useLocation()

  const value = tabs.some((t) => t.value === tab) ? (tab as T) : defaultTab
  const withoutTab = tab ? pathname.slice(0, -(tab.length + 1)) : pathname
  const basePath = withoutTab.replace(/\/$/, '')

  return { value, basePath }
}
