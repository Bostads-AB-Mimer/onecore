import { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { cn } from '@/shared/lib/utils'
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
}: ResponsiveTableProps) {
  const isMobile = useIsMobile()

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
        {data.map((item) => (
          <Card key={keyExtractor(item)} className="overflow-hidden">
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
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
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
          {data.map((item) => (
            <TableRow key={keyExtractor(item)} className="min-h-[44px]">
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(column.className, 'py-3')}
                >
                  {column.render(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
