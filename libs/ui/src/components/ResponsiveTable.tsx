import { Fragment, type ReactNode, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

import type { RowSelection } from '../hooks/useRowSelection'
import { useIsMobile } from '../hooks/useIsMobile'
import { cn } from '../lib/utils'
import { Button } from '../ui/Button'
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
  expandableContent?: (item: T) => ReactNode | null // rows open to show it; null = nothing to show
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
  expandableContent,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
        {data.map((item) => {
          const id = keyExtractor(item)
          const content = expandableContent?.(item) ?? null
          const isExpanded = expandedRows.has(id)
          return (
            <Card
              key={id}
              className="overflow-hidden"
              data-state={selection?.isSelected(id) ? 'selected' : undefined}
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
                  {content !== null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full justify-center"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpanded(id)
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronDown className="mr-1 h-4 w-4" />
                          Dölj detaljer
                        </>
                      ) : (
                        <>
                          <ChevronRight className="mr-1 h-4 w-4" />
                          Visa detaljer
                        </>
                      )}
                    </Button>
                  )}
                  {isExpanded && content !== null && (
                    <div className="mt-2 border-t pt-3">{content}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
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
            {expandableContent && <TableHead className="w-[40px]" />}
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
            const content = expandableContent?.(item) ?? null
            const isExpanded = expandedRows.has(id)
            return (
              <Fragment key={id}>
                <TableRow
                  className={cn('min-h-[44px]', onRowClick && 'cursor-pointer')}
                  data-state={
                    selection?.isSelected(id) ? 'selected' : undefined
                  }
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {expandableContent && (
                    <TableCell className="py-3">
                      {content !== null && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          aria-label={
                            isExpanded ? 'Dölj detaljer' : 'Visa detaljer'
                          }
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded(id)
                          }}
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
                {isExpanded && content !== null && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell
                      colSpan={columns.length + (selection ? 1 : 0) + 1}
                      className="py-4"
                    >
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
