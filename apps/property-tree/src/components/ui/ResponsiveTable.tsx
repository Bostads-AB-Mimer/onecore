import { useIsMobile } from '@/hooks/useMobile'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v2/Table'
import { Card, CardContent } from '@/components/ui/v2/Card'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface ResponsiveTableColumn {
  key: string
  label: string
  render: (item: any) => ReactNode
  className?: string
  hideOnMobile?: boolean
}

interface ResponsiveTableProps {
  data: any[]
  columns: ResponsiveTableColumn[]
  keyExtractor: (item: any) => string
  emptyMessage?: string
  mobileCardRenderer?: (item: any) => ReactNode
}

export function ResponsiveTable({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'Inga resultat hittades',
  mobileCardRenderer,
}: ResponsiveTableProps) {
  const isMobile = useIsMobile()

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
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.label}
              </TableHead>
            ))}
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
