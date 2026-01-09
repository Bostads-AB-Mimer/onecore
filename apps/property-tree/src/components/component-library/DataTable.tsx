import { useState, Fragment } from 'react'
import { MoreHorizontal, Edit, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/v2/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  label: string
  render: (item: T) => React.ReactNode
  width?: string
  className?: string
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
  expandableContent?: (item: T) => React.ReactNode | null
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
}: DataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-secondary rounded-lg"></div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  const renderActionsCell = (item: T) => (
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
  )

  // Check if item has expandable content
  const hasExpandableContent = (item: T) => {
    if (!expandableContent) return false
    const content = expandableContent(item)
    return content !== null
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="border-b">
            <tr>
              {expandableContent && (
                <th className="w-[40px] py-3 px-2"></th>
              )}
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
              <th className="w-[50px] py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => {
              const isExpanded = expandedRows.has(item.id)
              const canExpand = hasExpandableContent(item)
              const expandedContentNode = canExpand ? expandableContent!(item) : null

              return (
                <Fragment key={item.id}>
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
                              toggleExpanded(item.id)
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
                    <td className="py-3 px-4 text-sm">
                      {renderActionsCell(item)}
                    </td>
                  </tr>
                  {isExpanded && expandedContentNode && (
                    <tr key={`${item.id}-expanded`} className="bg-muted/30">
                      <td
                        colSpan={columns.length + (expandableContent ? 2 : 1)}
                        className="py-4 px-6"
                      >
                        {expandedContentNode}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {data.map((item) => {
          const isExpanded = expandedRows.has(item.id)
          const canExpand = hasExpandableContent(item)
          const expandedContentNode = canExpand ? expandableContent!(item) : null

          return (
            <div
              key={item.id}
              className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
            >
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

                {/* Expandable content for mobile */}
                {canExpand && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpanded(item.id)
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
                  <div className="pt-3 border-t bg-muted/30 -mx-4 px-4 pb-3 -mb-4 rounded-b-lg">
                    {expandedContentNode}
                  </div>
                )}

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
            </div>
          )
        })}
      </div>
    </>
  )
}
