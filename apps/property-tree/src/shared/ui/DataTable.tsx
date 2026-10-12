import { useEffect, useRef, useState } from 'react'
import { Edit, MoreHorizontal, Trash2 } from 'lucide-react'

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
import { ResponsiveTableComponents } from './ResponsiveTableComponents'

export interface Column<T> extends HideableColumn<T> {
  key: string
  label: string
  render: (item: T) => React.ReactNode
  width?: string
  className?: string
  hideOnMobile?: boolean
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
}

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
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)

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
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const shownColumns = visibleColumns(columns, data)

  // Add actions column to the columns array
  const columnsWithActions: Column<T>[] = [
    ...shownColumns,
    {
      key: 'actions',
      label: '',
      render: renderActionsCell,
      className: 'w-[50px]',
      hideOnMobile: true,
    },
  ]

  // Mobile card renderer with action buttons
  const mobileCardRenderer = (item: T) => (
    <div className="space-y-3">
      {/* Column data */}
      <div className="space-y-2">
        {shownColumns
          .filter((col) => !col.hideOnMobile)
          .map((column) => (
            <div
              key={column.key}
              className="flex justify-between items-start gap-2"
            >
              <span className="text-xs text-muted-foreground font-medium shrink-0">
                {column.label}:
              </span>
              <span className="text-sm text-right break-words">
                {column.render(item)}
              </span>
            </div>
          ))}
      </div>

      {/* Action buttons for mobile */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(item)
          }}
          className="flex-1 min-w-[100px]"
        >
          <Edit className="h-4 w-4 mr-1" />
          Redigera
        </Button>
        {visibleActions(actions, item).map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              action.onClick(item)
            }}
            className="flex-1 min-w-[100px]"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item)
          }}
          className="flex-1 min-w-[100px] text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Ta bort
        </Button>
      </div>
    </div>
  )

  const paginatedData = data.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <>
      <ResponsiveTableComponents
        data={paginatedData}
        columns={columnsWithActions}
        keyExtractor={(item) => item.id}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
        expandableContent={expandableContent}
        mobileCardRenderer={mobileCardRenderer}
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
