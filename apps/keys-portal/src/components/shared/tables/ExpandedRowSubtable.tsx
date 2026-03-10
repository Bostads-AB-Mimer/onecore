import { Spinner } from '@/components/ui/spinner'
import { TableRow, TableCell } from '@/components/ui/table'

interface ExpandedRowSubtableProps {
  colSpan: number
  isLoading: boolean
  hasData: boolean
  emptyMessage?: string
  headerClassName?: string
  children: React.ReactNode // expects <tr> elements
}

/**
 * Wrapper for expanded row content rendered as a nested subtable.
 *
 * Renders children inside a nested <table><tbody> so that parent table
 * columns stay stable while the subtable has its own column structure.
 * Each row in the nested table is individually hoverable.
 */
export function ExpandedRowSubtable({
  colSpan,
  isLoading,
  hasData,
  emptyMessage = 'Inga data att visa',
  headerClassName,
  children,
}: ExpandedRowSubtableProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <table className="w-full bg-background">
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={colSpan} className="text-center py-8">
                  <Spinner className="mx-auto" />
                </td>
              </tr>
            ) : !hasData ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="text-center text-muted-foreground py-8"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </TableCell>
    </TableRow>
  )
}
