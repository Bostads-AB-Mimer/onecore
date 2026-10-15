import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import type { RowSelection } from '../hooks/useRowSelection'
import { useIsMobile } from '../hooks/useIsMobile'
import { cn } from '../lib/utils'
import { Card, CardContent } from '../ui/Card'
import { Checkbox } from '../ui/Checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table'

export interface ResponsiveTableColumn<T> {
  key: string
  label: ReactNode
  render: (item: T) => ReactNode
  className?: string
  hideOnMobile?: boolean
  sortKey?: string // makes the header clickable; reported to onSort
}

export type SortOrder = 'asc' | 'desc'

export interface ResponsiveTableProps<T> {
  data: readonly T[]
  columns: readonly ResponsiveTableColumn<T>[]
  keyExtractor: (item: T) => string
  emptyMessage?: string
  mobileCardRenderer?: (item: T) => ReactNode // replaces the per-column card layout
  selection?: RowSelection<T> // from useRowSelection; adds a checkbox column
  onRowClick?: (item: T) => void
  sortBy?: string
  sortOrder?: SortOrder
  onSort?: (sortKey: string, sortOrder: SortOrder | undefined) => void // asc, desc, then off
}

const headerChecked = (state: RowSelection<unknown>['pageState']) =>
  state === 'all' ? true : state === 'some' ? 'indeterminate' : false

/** Table that collapses into cards on small screens. Sorting and selection
 * are controlled: the page owns that state, the table only renders it. */
export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'Inga resultat hittades',
  mobileCardRenderer,
  selection,
  onRowClick,
  sortBy,
  sortOrder,
  onSort,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile()

  const handleSort = (sortKey: string) => {
    if (!onSort) return
    if (sortBy !== sortKey) onSort(sortKey, 'asc')
    else if (sortOrder === 'asc') onSort(sortKey, 'desc')
    else onSort(sortKey, undefined)
  }

  const rowCheckbox = (item: T) => {
    if (!selection) return null
    const id = keyExtractor(item)
    return (
      <Checkbox
        checked={selection.isSelected(id)}
        onCheckedChange={() => selection.toggle(id)}
        onClick={(e) => {
          e.stopPropagation()
          // Radix skips its own toggle (and onCheckedChange) when the click
          // is default-prevented, so shift-click only runs the range toggle.
          if (e.shiftKey) {
            e.preventDefault()
            selection.toggleRange(id)
          }
        }}
        aria-label={`Välj ${id}`}
      />
    )
  }

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  if (isMobile) {
    const visibleColumns = columns.filter((col) => !col.hideOnMobile)
    return (
      <div className="space-y-3">
        {data.map((item) => (
          <Card
            key={keyExtractor(item)}
            className="overflow-hidden"
            data-state={
              selection?.isSelected(keyExtractor(item)) ? 'selected' : undefined
            }
            onClick={onRowClick ? () => onRowClick(item) : undefined}
          >
            <CardContent className="flex min-h-[44px] items-start gap-3 p-4">
              {selection && <div className="pt-1">{rowCheckbox(item)}</div>}
              <div className="min-w-0 flex-1">
                {mobileCardRenderer ? (
                  mobileCardRenderer(item)
                ) : (
                  <div className="space-y-3">
                    {visibleColumns.map((column) => (
                      <div
                        key={column.key}
                        className="flex min-h-[44px] items-center justify-between"
                      >
                        <span className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">
                          {column.label}:
                        </span>
                        <div className="ml-2 flex min-h-[44px] items-center text-right text-sm">
                          {column.render(item)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    // @container lets columns hide themselves on the table's own width via
    // className (e.g. 'hidden @4xl:table-cell'). bg-white so it reads as a
    // surface outside a Card too.
    <div className="@container overflow-x-auto rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            {selection && (
              <TableHead className="w-10 px-2">
                <Checkbox
                  checked={headerChecked(selection.pageState)}
                  onCheckedChange={selection.togglePage}
                  aria-label="Välj alla"
                />
              </TableHead>
            )}
            {columns.map((column) => {
              const sortKey = onSort ? column.sortKey : undefined
              const isActive = !!sortKey && sortBy === sortKey
              return (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.className,
                    sortKey && 'cursor-pointer select-none hover:bg-muted/50'
                  )}
                  aria-sort={
                    isActive && sortOrder
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  onClick={sortKey ? () => handleSort(sortKey) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {sortKey && (
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
            const id = keyExtractor(item)
            return (
              <TableRow
                key={id}
                className={cn('min-h-[44px]', onRowClick && 'cursor-pointer')}
                data-state={selection?.isSelected(id) ? 'selected' : undefined}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {selection && (
                  <TableCell className="px-2 py-3">
                    {rowCheckbox(item)}
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
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
