import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

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
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'Inga resultat hittades',
  mobileCardRenderer,
  onRowClick,
}: ResponsiveTableProps<T>) {
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
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={cn(
                  'border-b hover:bg-muted/50 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('py-3 px-4 text-sm', column.className)}
                  >
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
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
          </div>
        ))}
      </div>
    </>
  )
}
