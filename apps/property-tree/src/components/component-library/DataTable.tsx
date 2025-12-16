import { MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { ResponsiveTable } from '@/components/shared/v2/ResponsiveTable'
import { Button } from '@/components/ui/v2/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

export interface Column<T> {
  key: string
  label: string
  render: (item: T) => React.ReactNode
  width?: string
}

export interface DataTableAction<T> {
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
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-secondary rounded-lg"></div>
        ))}
      </div>
    )
  }

  // Add actions column to the columns array for desktop view
  const columnsWithActions = [
    ...columns,
    {
      key: 'actions',
      label: '',
      render: (item: T) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
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
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDelete(item)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Ta bort
            </DropdownMenuItem>
            {actions.map((action, index) => (
              <DropdownMenuItem
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  action.onClick(item)
                }}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: 'w-[50px]',
    },
  ]

  // Custom mobile card renderer with action buttons
  const mobileCardRenderer = (item: T) => (
    <div
      className="space-y-3"
      onClick={onRowClick ? () => onRowClick(item) : undefined}
    >
      {/* Column data */}
      <div className="space-y-2">
        {columns.map((column) => (
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
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item)
          }}
          className="flex-1 min-w-[100px]"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Ta bort
        </Button>
        {actions.map((action, index) => (
          <Button
            key={index}
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
      </div>
    </div>
  )

  return (
    <ResponsiveTable
      data={data}
      columns={columnsWithActions}
      keyExtractor={(item) => item.id}
      emptyMessage={emptyMessage}
      mobileCardRenderer={mobileCardRenderer}
      onRowClick={onRowClick}
    />
  )
}
