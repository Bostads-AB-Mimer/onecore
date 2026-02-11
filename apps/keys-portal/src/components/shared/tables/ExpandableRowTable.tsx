import React from 'react'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useExpandableRows } from '@/hooks/useExpandableRows'

export interface ExpandableRowRenderProps<D = unknown> {
  isExpanded: boolean
  isLoading: boolean
  onToggle: () => void
  loadedData?: D | null
}

export interface ExpandedContentOptions<D = unknown> {
  headerClassName?: string
  loadedData?: D | null
}

export interface ExpandableRowTableProps<T, D = unknown> {
  items: T[]
  getItemId: (item: T) => string
  columnCount: number
  /** Shows a spinner instead of the empty message when true */
  isLoadingItems?: boolean
  emptyMessage?: string
  className?: string
  /**ClassName applied to the subtable header row. Passed through to renderExpandedContent. */
  subtableHeaderClassName?: string
  /** Async callback to load data when a row is expanded. Result is passed to renderExpandedContent. */
  onExpand?: (id: string) => Promise<D>

  // Render functions - consumer defines their own columns
  renderHeader: () => React.ReactNode
  renderRow: (item: T, props: ExpandableRowRenderProps<D>) => React.ReactNode
  renderExpandedContent: (
    item: T,
    options: ExpandedContentOptions<D>
  ) => React.ReactNode
}

/**
 * Generic table component with expandable rows.
 *
 * Expanded content is rendered in a nested table inside a colSpan cell.
 * This keeps parent table columns stable while allowing subtables to have
 * their own column structure. Each row in the nested table is still
 * individually hoverable.
 *
 * Supports optional async loading via onExpand — shows a spinner while
 * data is being fetched, then passes loadedData to renderExpandedContent.
 */
export function ExpandableRowTable<T, D = unknown>({
  items,
  getItemId,
  columnCount,
  isLoadingItems = false,
  emptyMessage = 'Inga objekt att visa',
  className,
  subtableHeaderClassName = 'bg-muted/50 hover:bg-muted/70',
  onExpand,
  renderHeader,
  renderRow,
  renderExpandedContent,
}: ExpandableRowTableProps<T, D>) {
  const { isExpanded, toggle, isLoading, loadedData, expandedId } =
    useExpandableRows<D>({ onExpand })

  return (
    <div
      className={className ?? 'border rounded-lg overflow-hidden bg-background'}
    >
      <Table>
        <TableHeader className="bg-background">{renderHeader()}</TableHeader>
        <TableBody>
          {isLoadingItems || items.length === 0 ? (
            <TableEmptyState
              colSpan={columnCount}
              message={emptyMessage}
              isLoading={isLoadingItems}
            />
          ) : (
            items.map((item) => {
              const id = getItemId(item)
              const expanded = isExpanded(id)
              const isLoadingThis = expanded && isLoading && expandedId === id

              return (
                <React.Fragment key={id}>
                  {renderRow(item, {
                    isExpanded: expanded,
                    isLoading: isLoadingThis,
                    onToggle: () => toggle(id),
                    loadedData: expanded && !isLoadingThis ? loadedData : null,
                  })}
                  {expanded && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={columnCount} className="p-0">
                        <table className="w-full bg-background">
                          <tbody>
                            {isLoadingThis ? (
                              <tr>
                                <td
                                  colSpan={columnCount}
                                  className="text-center py-8"
                                >
                                  <Spinner className="mx-auto" />
                                </td>
                              </tr>
                            ) : (
                              renderExpandedContent(item, {
                                headerClassName: subtableHeaderClassName,
                                loadedData,
                              })
                            )}
                          </tbody>
                        </table>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
