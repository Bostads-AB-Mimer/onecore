import { useState, Fragment, ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/v2/Button'

interface Column<T> {
  key: string
  label: string
  render: (item: T) => ReactNode
  className?: string
  hideOnMobile?: boolean
}

interface ResponsiveTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  emptyMessage?: string
  mobileCardRenderer?: (item: T) => ReactNode
  onRowClick?: (item: T) => void
  expandableContent?: (item: T) => ReactNode | null
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'Inga resultat hittades',
  mobileCardRenderer,
  onRowClick,
  expandableContent,
}: ResponsiveTableProps<T>) {
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

  const hasExpandableContent = (item: T) => {
    if (!expandableContent) return false
    const content = expandableContent(item)
    return content !== null
  }

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
        <table className="w-full">
          <thead className="border-b">
            <tr>
              {expandableContent && <th className="w-[40px] py-3 px-2"></th>}
              {columns.map((column) => (
                <th
                  key={column.key}
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
                      onRowClick && 'cursor-pointer'
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {expandableContent && (
                      <td className="py-3 px-2">
                        {canExpand && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
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
                        className={cn('py-3 px-4 text-sm', column.className)}
                      >
                        {column.render(item)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && expandedContentNode && (
                    <tr className="bg-muted/30">
                      <td
                        colSpan={columns.length + (expandableContent ? 1 : 0)}
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
      <div className="md:hidden space-y-3">
        {data.map((item) => {
          const itemKey = keyExtractor(item)
          const isExpanded = expandedRows.has(itemKey)
          const canExpand = hasExpandableContent(item)
          const expandedContentNode = canExpand
            ? expandableContent!(item)
            : null

          return (
            <div
              key={itemKey}
              className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {mobileCardRenderer ? (
                mobileCardRenderer(item)
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
              {canExpand && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center mt-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpanded(itemKey)
                  }}
                >
                  {isExpanded ? (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Dölj detaljer
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4 mr-1" />
                      Visa detaljer
                    </>
                  )}
                </Button>
              )}

              {isExpanded && expandedContentNode && (
                <div className="pt-3 mt-2 border-t bg-muted/30 -mx-4 px-4 pb-3 -mb-4 rounded-b-lg">
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
