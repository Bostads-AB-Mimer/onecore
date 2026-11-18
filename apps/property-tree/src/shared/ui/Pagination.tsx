import { useId } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalRecords: number
  pageSize: number
  onPageChange: (page: number) => void
  isFetching?: boolean
  /** Rows-per-page choices. The selector shows only with onPageSizeChange. */
  pageSizeOptions?: readonly number[]
  onPageSizeChange?: (pageSize: number) => void
}

export const Pagination = ({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  isFetching,
  pageSizeOptions,
  onPageSizeChange,
}: PaginationProps) => {
  const pageSizeLabelId = useId()
  const pageSizeSelect =
    onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 0
      ? { options: pageSizeOptions, onChange: onPageSizeChange }
      : null

  // With a page size selector the bar stays on a single page, so the user can
  // switch back to a smaller page size.
  if (totalPages <= 1 && (!pageSizeSelect || totalRecords === 0)) return null

  const startRecord = (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalRecords)

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | 'ellipsis')[] = [1]

    if (currentPage > 3) pages.push('ellipsis')

    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)

    for (let i = start; i <= end; i++) pages.push(i)

    if (currentPage < totalPages - 2) pages.push('ellipsis')

    pages.push(totalPages)
    return pages
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Visar {startRecord}-{endRecord} av{' '}
          {totalRecords.toLocaleString('sv-SE')}
        </span>
        {isFetching && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {pageSizeSelect && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span id={pageSizeLabelId}>Rader per sida</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => pageSizeSelect.onChange(Number(value))}
            disabled={isFetching}
          >
            <SelectTrigger
              className="h-8 w-[80px]"
              aria-labelledby={pageSizeLabelId}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeSelect.options.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1 || isFetching}
            className="h-8 w-8 p-0"
            title="Första sidan"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1 || isFetching}
            className="h-8 w-8 p-0"
            title="Föregående sida"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {getPageNumbers().map((page, index) =>
            page === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-muted-foreground"
              >
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(page)}
                disabled={isFetching}
                className="h-8 w-8 p-0"
              >
                {page}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isFetching}
            className="h-8 w-8 p-0"
            title="Nästa sida"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || isFetching}
            className="h-8 w-8 p-0"
            title="Sista sidan"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
