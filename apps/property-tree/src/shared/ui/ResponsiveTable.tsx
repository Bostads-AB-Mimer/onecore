import { Fragment, ReactNode, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/Table'

interface ResponsiveTableColumn {
  key: string
  label: ReactNode
  render: (item: any) => ReactNode
  className?: string
  hideOnMobile?: boolean
  /** When set, makes this column header clickable for sorting */
  sortKey?: string
}

interface ResponsiveTableProps {
  data: any[]
  columns: ResponsiveTableColumn[]
  keyExtractor: (item: any) => string
  emptyMessage?: string
  mobileCardRenderer?: (item: any) => ReactNode
  /** Current sort field */
  sortBy?: string
  /** Current sort direction */
  sortOrder?: 'asc' | 'desc'
  /** Called when a sortable column header is clicked */
  onSort?: (sortKey: string, sortOrder: 'asc' | 'desc' | undefined) => void
  /** When set, rows can be expanded to show extra content. Return null for a row with nothing to show. */
  expandableContent?: (item: any) => ReactNode | null
}

export function ResponsiveTable({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'Inga resultat hittades',
  mobileCardRenderer,
  sortBy,
  sortOrder,
  onSort,
  expandableContent,
}: ResponsiveTableProps) {
  const isMobile = useIsMobile()
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

  const handleSort = (sortKey: string) => {
    if (!onSort) return

    if (sortBy === sortKey) {
      if (sortOrder === 'asc') {
        onSort(sortKey, 'desc')
      } else {
        // Clear sort
        onSort(sortKey, undefined)
      }
    } else {
      onSort(sortKey, 'asc')
    }
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  if (isMobile && mobileCardRenderer) {
    return (
      <div className="space-y-3">
        {data.map((item) => (
          <Card key={keyExtractor(item)} className="overflow-hidden">
            <CardContent className="p-4 min-h-[44px] flex items-center">
              {mobileCardRenderer(item)}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isMobile) {
    // Fallback mobile layout when no custom renderer provided
    const visibleColumns = columns.filter((col) => !col.hideOnMobile)

    return (
      <div className="space-y-3">
        {data.map((item) => {
          const itemKey = keyExtractor(item)
          const isExpanded = expandedRows.has(itemKey)
          const content = expandableContent?.(item) ?? null

          return (
            <Card key={itemKey} className="overflow-hidden">
              <CardContent className="p-4 space-y-3 min-h-[44px]">
                {visibleColumns.map((column) => (
                  <div
                    key={column.key}
                    className="flex justify-between items-center min-h-[44px]"
                  >
                    <span className="text-sm font-medium text-muted-foreground min-w-0 flex-1">
                      {column.label}:
                    </span>
                    <div className="text-sm text-right ml-2 flex items-center min-h-[44px]">
                      {column.render(item)}
                    </div>
                  </div>
                ))}

                {content !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => toggleExpanded(itemKey)}
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

                {isExpanded && content !== null && (
                  <div className="pt-3 border-t bg-muted/30 -mx-4 px-4 pb-1 -mb-3 rounded-b-lg">
                    {content}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    // @container lets columns hide themselves based on the table's own width
    // (e.g. 'hidden @4xl:table-cell' via column className). bg-white so the
    // table reads as a surface even outside a Card.
    <div className="@container rounded-md border bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {expandableContent && <TableHead className="w-[40px]" />}
            {columns.map((column) => {
              const isSortable = !!column.sortKey && !!onSort
              const isActive = sortBy === column.sortKey

              return (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.className,
                    isSortable && 'cursor-pointer select-none hover:bg-muted/50'
                  )}
                  onClick={
                    isSortable ? () => handleSort(column.sortKey!) : undefined
                  }
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {isSortable && (
                      <span className="ml-1">
                        {isActive && sortOrder === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : isActive && sortOrder === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const itemKey = keyExtractor(item)
            const isExpanded = expandedRows.has(itemKey)
            const content = expandableContent?.(item) ?? null

            return (
              <Fragment key={itemKey}>
                <TableRow className="min-h-[44px]">
                  {expandableContent && (
                    <TableCell className="py-3">
                      {content && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleExpanded(itemKey)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(column.className, 'py-3')}
                    >
                      {column.render(item)}
                    </TableCell>
                  ))}
                </TableRow>
                {isExpanded && content && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={columns.length + 1} className="py-4">
                      {content}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
