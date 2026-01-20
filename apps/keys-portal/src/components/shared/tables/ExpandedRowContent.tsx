import { Loader2 } from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface ExpandedRowContentProps {
  colSpan: number
  isLoading: boolean
  hasData: boolean
  emptyMessage?: string
  className?: string
  children: React.ReactNode
}

/** Wrapper for expanded row content with loading and empty states */
export function ExpandedRowContent({
  colSpan,
  isLoading,
  hasData,
  emptyMessage = 'Inga data att visa',
  className,
  children,
}: ExpandedRowContentProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={cn('p-6 bg-muted/30', className)}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !hasData ? (
          <div className="text-center text-muted-foreground py-8">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </TableCell>
    </TableRow>
  )
}
