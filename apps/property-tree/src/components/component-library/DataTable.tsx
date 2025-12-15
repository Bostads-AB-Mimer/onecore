import { MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
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

  if (data.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} style={{ width: col.width }}>
                {col.label}
              </TableHead>
            ))}
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow
              key={item.id}
              className={onRowClick ? 'hover:bg-muted/50 cursor-pointer' : 'hover:bg-muted/50'}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <TableCell key={col.key}>{col.render(item)}</TableCell>
              ))}
              <TableCell>
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
