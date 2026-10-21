import { Fragment, KeyboardEvent, ReactNode, useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'

interface Column<T> {
  key: string
  label: string
  render: (item: T) => ReactNode
  className?: string
  /** Any column with a width switches the table to a fixed layout. */
  width?: string
  hideOnMobile?: boolean
}

interface ResponsiveTableComponentsProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  emptyMessage?: string
  /** Receives the row's expand toggle, if any, to place inside the card. */
  mobileCardRenderer?: (item: T, expandToggle: ReactNode) => ReactNode
  onRowClick?: (item: T) => void
  expandableContent?: (item: T) => ReactNode | null
  /** Names a row for screen readers, e.g. on its expand button. */
  rowLabel?: (item: T) => string
  /** False when a link in the row carries keyboard focus instead of the row. */
  rowsFocusable?: boolean
}

export function ResponsiveTableComponents<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'Inga resultat hittades',
  mobileCardRenderer,
  onRowClick,
  expandableContent,
  rowLabel,
  rowsFocusable = true,
}: ResponsiveTableComponentsProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleExpanded = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Enter or Space on the row itself opens it; keys from buttons inside stay theirs.
  const openOnKey = (e: KeyboardEvent, item: T) => {
    if (!onRowClick || e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick(item)
    }
  }

  const rowFocusClass =
    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'

  const hasExpandableContent = (item: T) => {
    if (!expandableContent) return false
    const content = expandableContent(item)
    return content !== null
  }

  const expandLabel = (item: T, isExpanded: boolean) => {
    const label = rowLabel?.(item)
    const verb = isExpanded ? 'Visa mindre' : 'Visa mer'
    return label ? `${verb} om ${label}` : verb
  }

  const fixedLayout = columns.some((column) => column.width)
  const focusableRow = Boolean(onRowClick) && rowsFocusable
  const showExpander =
    Boolean(expandableContent) && data.some(hasExpandableContent)

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className={cn('w-full', fixedLayout && 'table-fixed')}>
          <thead className="border-b">
            <tr>
              {showExpander && <th className="w-[40px] py-3 px-2"></th>}
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'text-left py-3 px-4 text-sm font-medium text-muted-foreground',
                    column.className
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => {
              const itemKey = keyExtractor(item)
              const isExpanded = expandedRows.has(itemKey)
              const canExpand = hasExpandableContent(item)
              const expandedContentNode = canExpand
                ? expandableContent!(item)
                : null

              return (
                <Fragment key={itemKey}>
                  <tr
                    className={cn(
                      'border-b hover:bg-muted/50 transition-colors',
                      onRowClick && 'cursor-pointer',
                      focusableRow && rowFocusClass
                    )}
                    tabIndex={focusableRow ? 0 : undefined}
                    onClick={() => onRowClick?.(item)}
                    onKeyDown={(e) => openOnKey(e, item)}
                  >
                    {showExpander && (
                      <td className="py-2 px-2">
                        {canExpand && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            aria-label={expandLabel(item, isExpanded)}
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpanded(itemKey)
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'py-2 px-4 text-sm',
                          fixedLayout && 'break-words',
                          column.className
                        )}
                      >
                        {column.render(item)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && expandedContentNode && (
                    <tr className="bg-muted/30">
                      <td
                        colSpan={columns.length + (showExpander ? 1 : 0)}
                        className="py-4 px-6"
                      >
                        {expandedContentNode}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {data.map((item) => {
          const itemKey = keyExtractor(item)
          const isExpanded = expandedRows.has(itemKey)
          const canExpand = hasExpandableContent(item)
          const expandedContentNode = canExpand
            ? expandableContent!(item)
            : null
          const expandToggle = canExpand ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={expandLabel(item, isExpanded)}
              aria-expanded={isExpanded}
              onClick={(e) => {
                e.stopPropagation()
                toggleExpanded(itemKey)
              }}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          ) : null

          return (
            <div
              key={itemKey}
              className={cn(
                'border rounded-lg p-3 bg-card hover:bg-muted/50 transition-colors',
                focusableRow && rowFocusClass
              )}
              tabIndex={focusableRow ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              onKeyDown={(e) => openOnKey(e, item)}
            >
              {mobileCardRenderer ? (
                mobileCardRenderer(item, expandToggle)
              ) : (
                <div className="space-y-2">
                  {columns
                    .filter((col) => !col.hideOnMobile)
                    .map((column) => (
                      <div key={column.key} className="flex justify-between">
                        <span className="text-xs text-muted-foreground">
                          {column.label}:
                        </span>
                        <span className="text-sm">{column.render(item)}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Expandable content for mobile */}
              {canExpand && !mobileCardRenderer && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center mt-2"
                  aria-expanded={isExpanded}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpanded(itemKey)
                  }}
                >
                  {isExpanded ? (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Visa mindre
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4 mr-1" />
                      Visa mer
                    </>
                  )}
                </Button>
              )}

              {isExpanded && expandedContentNode && (
                <div className="pt-3 mt-2 border-t bg-muted/30 -mx-3 px-3 pb-3 -mb-3 rounded-b-lg">
                  {expandedContentNode}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
