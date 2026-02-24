import { Spinner } from '@/components/ui/spinner'
import { TableRow, TableCell } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface ExpandedRowFreeContentProps {
  colSpan: number
  isLoading: boolean
  hasData: boolean
  emptyMessage?: string
  className?: string
  children: React.ReactNode
}

/** Wrapper for expanded row free-form content (divs, lists, etc.) with loading and empty states */
export function ExpandedRowFreeContent({
  colSpan,
  isLoading,
  hasData,
  emptyMessage = 'Inga data att visa',
  className,
  children,
}: ExpandedRowFreeContentProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={cn('p-6 bg-muted/30', className)}>
        {isLoading ? (
          <Spinner centered />
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
