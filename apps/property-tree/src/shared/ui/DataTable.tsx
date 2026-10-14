import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Edit,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'
import { Pagination } from '@/shared/ui/Pagination'

import {
  type HideableAction,
  type HideableColumn,
  visibleActions,
  visibleColumns,
} from './dataTableColumns'
import {
  ariaSort,
  type ColumnSort,
  nextSort,
  sortOptionLabel,
  type SortOrder,
  sortRows,
  type TableSort,
} from './dataTableSort'
import { ResponsiveTableComponents } from './ResponsiveTableComponents'

export interface Column<T> extends HideableColumn<T> {
  key: string
  label: string
  render: (item: T) => React.ReactNode
  width?: string
  className?: string
  hideOnMobile?: boolean
  /** Makes the header sortable when the table gets onSortChange. */
  sort?: ColumnSort<T>
}

export interface DataTableAction<T> extends HideableAction<T> {
  label: string
  onClick: (item: T) => void
  icon?: React.ReactNode
}

export interface DataTableProps<T extends { id: string }> {
  data: T[]
  columns: Column<T>[]
  isLoading: boolean
  onEdit: (item: T) => void
  onDelete: (item: T) => void
  onRowClick?: (item: T) => void
  emptyMessage?: string
  actions?: DataTableAction<T>[]
  expandableContent?: (item: T) => React.ReactNode | null
  /** Rows per page for client-side pagination. Defaults to 20. */
  pageSize?: number
  /** Names a row for screen readers, e.g. in the actions button label. */
  getRowLabel?: (item: T) => string
  /** Makes the first cell a link to the row's page, for keyboard and new tabs. */
  getRowHref?: (item: T) => string
  /** Marks rows the user arrived for, e.g. from a deep link. */
  isRowHighlighted?: (item: T) => boolean
  /** Why a row cannot be deleted; disables Ta bort and shows the reason. */
  deleteBlockedReason?: (item: T) => string | undefined
  /** The active sort. Sorting is controlled: the table only asks to change it. */
  sort?: TableSort
  onSortChange?: (sort: TableSort) => void
  /** With this sort active the rows are shown in the order given. */
  defaultSort?: TableSort
  /** The rows arrive sorted, e.g. one server page; never re-sort them. */
  serverSorted?: boolean
}

const sameSort = (a: TableSort | undefined, b: TableSort | undefined) =>
  a?.key === b?.key && a?.order === b?.order

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading,
  onEdit,
  onDelete,
  onRowClick,
  emptyMessage = 'Inga objekt att visa',
  actions = [],
  expandableContent,
  pageSize = 20,
  getRowLabel,
  deleteBlockedReason,
  getRowHref,
  isRowHighlighted,
  sort,
  onSortChange,
  defaultSort,
  serverSorted = false,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)

  const sortable = onSortChange !== undefined
  const sortedData = useMemo(() => {
    if (!sortable || !sort || serverSorted || sameSort(sort, defaultSort)) {
      return data
    }
    const value = columns.find((column) => column.key === sort.key)?.sort?.value
    return value ? sortRows(data, value, sort.order) : data
  }, [data, columns, sortable, sort, serverSorted, defaultSort])

  useEffect(() => {
    setCurrentPage(1)
  }, [sort?.key, sort?.order])

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))

  // Reset to a valid page when the data set shrinks (search, filter, delete)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  // Jump back to the first page when new rows appear (e.g. clearing a search
  // restores the unfiltered set) — staying on a high page would show an
  // arbitrary slice. Removal-only changes keep the current page; the clamp
  // above handles pages that fall out of range.
  const knownIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const ids = new Set(data.map((item) => item.id))
    const hasNewIds = [...ids].some((id) => !knownIdsRef.current.has(id))
    knownIdsRef.current = ids
    if (hasNewIds) {
      setCurrentPage(1)
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-secondary rounded-lg"></div>
        ))}
      </div>
    )
  }

  const actionsLabel = (item: T) =>
    getRowLabel ? `Åtgärder för ${getRowLabel(item)}` : 'Åtgärder'

  const renderMenuContent = (item: T) => (
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        onClick={(e) => {
          e.stopPropagation()
          onEdit(item)
        }}
      >
        <Edit className="h-4 w-4 mr-2" />
        Redigera
      </DropdownMenuItem>
      {visibleActions(actions, item).map((action) => (
        <DropdownMenuItem
          key={action.label}
          onClick={(e) => {
            e.stopPropagation()
            action.onClick(item)
          }}
        >
          {action.icon}
          {action.label}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      {deleteBlockedReason?.(item) ? (
        <DropdownMenuItem disabled className="flex-col items-start">
          <span className="flex items-center">
            <Trash2 className="h-4 w-4 mr-2" />
            Ta bort
          </span>
          <span className="text-xs pl-6">{deleteBlockedReason(item)}</span>
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item)
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Ta bort
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  )

  const renderActionsCell = (item: T) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={actionsLabel(item)}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      {renderMenuContent(item)}
    </DropdownMenu>
  )

  const shownColumns = visibleColumns(columns, data).map((column, index) =>
    index === 0 && getRowHref
      ? {
          ...column,
          render: (item: T) => (
            <Link
              to={getRowHref(item)}
              onClick={(e) => e.stopPropagation()}
              className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {column.render(item)}
            </Link>
          ),
        }
      : column
  )

  const sortableColumns = sortable
    ? shownColumns.filter((column) => column.sort)
    : []

  const sortHeader = (column: Column<T>) => {
    const isActive = sort?.key === column.key
    const Icon = !isActive
      ? ArrowUpDown
      : sort.order === 'asc'
        ? ArrowUp
        : ArrowDown
    return (
      <button
        type="button"
        onClick={() => onSortChange?.(nextSort(sort, column))}
        className={cn(
          'group -mx-2 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive && 'text-foreground'
        )}
      >
        {column.label}
        <Icon
          aria-hidden="true"
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            !isActive &&
              'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60'
          )}
        />
      </button>
    )
  }

  const headedColumns = sortable
    ? shownColumns.map((column) =>
        column.sort
          ? {
              ...column,
              header: sortHeader(column),
              ariaSort: ariaSort(column, sort),
            }
          : column
      )
    : shownColumns

  // Add actions column to the columns array
  const columnsWithActions = [
    ...headedColumns,
    {
      key: 'actions',
      label: '',
      render: renderActionsCell,
      className: 'w-[72px]',
      hideOnMobile: true,
    },
  ]

  const mobileCardRenderer = (item: T, expandToggle: React.ReactNode) => {
    const [primary, ...rest] = shownColumns.filter((col) => !col.hideOnMobile)
    const details = rest.filter((column) => !column.isEmpty?.(item))

    return (
      <div className="space-y-1 text-sm">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1 break-words">
            {primary?.render(item)}
          </div>
          <div className="-my-2.5 -mr-1.5 flex shrink-0">
            {expandToggle}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={actionsLabel(item)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              {renderMenuContent(item)}
            </DropdownMenu>
          </div>
        </div>
        {details.length > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5">
            {details.map((column) => (
              <div key={column.key} className="flex min-w-0 gap-1.5">
                <dt className="shrink-0 text-muted-foreground">
                  {column.label}
                </dt>
                <dd className="min-w-0 break-words">{column.render(item)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    )
  }

  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <>
      {sortableColumns.length > 0 && data.length > 0 && (
        <div className="mb-3 md:hidden">
          <select
            aria-label="Sortera"
            value={sort ? `${sort.key}:${sort.order}` : ''}
            onChange={(e) => {
              const [key, order] = e.target.value.split(':')
              onSortChange?.({ key, order: order === 'desc' ? 'desc' : 'asc' })
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sortableColumns.flatMap((column) => {
              const first: SortOrder = column.sort?.firstOrder ?? 'asc'
              const orders: SortOrder[] = [
                first,
                first === 'asc' ? 'desc' : 'asc',
              ]
              return orders.map((order) => (
                <option
                  key={`${column.key}:${order}`}
                  value={`${column.key}:${order}`}
                >
                  {sortOptionLabel(column, order)}
                </option>
              ))
            })}
          </select>
        </div>
      )}
      <ResponsiveTableComponents
        data={paginatedData}
        columns={columnsWithActions}
        keyExtractor={(item) => item.id}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
        expandableContent={expandableContent}
        mobileCardRenderer={mobileCardRenderer}
        rowLabel={getRowLabel}
        isRowHighlighted={isRowHighlighted}
        rowsFocusable={!getRowHref}
      />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalRecords={data.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />
    </>
  )
}
