import type { ComponentType } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { cn } from '../lib/utils'

export interface SegmentedTab {
  value: string
  label: string
  count?: number
  icon?: ComponentType<{ className?: string }>
  disabled?: boolean
}

export interface SegmentedTabsProps {
  tabs: readonly SegmentedTab[]
  value: string
  /** Page URL without the tab segment, as returned by `useRouteTab`. */
  basePath: string
  className?: string
}

/**
 * Full-width segmented tab bar where every tab is a link to `basePath/value`.
 * Keeps the current query string except `page`, so filters survive a switch.
 */
export function SegmentedTabs({
  tabs,
  value,
  basePath,
  className,
}: SegmentedTabsProps) {
  const { search } = useLocation()
  const params = new URLSearchParams(search)
  params.delete('page')
  const query = params.toString()
  const suffix = query ? `?${query}` : ''

  return (
    <nav
      className={cn(
        'grid w-full auto-cols-fr grid-flow-col overflow-x-auto rounded-lg bg-slate-100/70 p-1',
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        const content = (
          <>
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-slate-200 text-muted-foreground'
                )}
              >
                {tab.count}
              </span>
            )}
          </>
        )
        const className = cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          active && 'bg-background text-foreground shadow-sm',
          tab.disabled && 'pointer-events-none opacity-50'
        )

        if (tab.disabled) {
          return (
            <span key={tab.value} aria-disabled="true" className={className}>
              {content}
            </span>
          )
        }
        return (
          <Link
            key={tab.value}
            to={`${basePath}/${tab.value}${suffix}`}
            aria-current={active ? 'page' : undefined}
            className={className}
          >
            {content}
          </Link>
        )
      })}
    </nav>
  )
}
