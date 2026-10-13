import type { ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react'

import { Button } from '../ui/Button'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalRecords: number
  pageSize: number
  onPageChange: (page: number) => void
  isFetching?: boolean
}

/** First, prev, a window of three around the current page, next, last. */
const pageNumbers = (
  currentPage: number,
  totalPages: number
): (number | 'ellipsis')[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages: (number | 'ellipsis')[] = [1]
  if (currentPage > 3) pages.push('ellipsis')
  for (
    let i = Math.max(2, currentPage - 1);
    i <= Math.min(totalPages - 1, currentPage + 1);
    i++
  ) {
    pages.push(i)
  }
  if (currentPage < totalPages - 2) pages.push('ellipsis')
  pages.push(totalPages)
  return pages
}

/** Renders nothing for a single page. */
export function Pagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  isFetching,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const startRecord = (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, totalRecords)
  const edge = (page: number, title: string, icon: ReactNode) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onPageChange(page)}
      disabled={page === currentPage || isFetching}
      className="h-8 w-8 p-0"
      title={title}
    >
      {icon}
    </Button>
  )

  return (
    <nav
      aria-label="Sidor"
      className="flex flex-col items-center justify-between gap-4 px-2 py-4 sm:flex-row"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Visar {startRecord}-{endRecord} av{' '}
          {totalRecords.toLocaleString('sv-SE')}
        </span>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      <div className="flex items-center gap-1">
        {edge(1, 'Första sidan', <ChevronsLeft className="h-4 w-4" />)}
        {edge(
          Math.max(1, currentPage - 1),
          'Föregående sida',
          <ChevronLeft className="h-4 w-4" />
        )}
        {pageNumbers(currentPage, totalPages).map((page, index) =>
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
              aria-current={currentPage === page ? 'page' : undefined}
              className="h-8 w-8 p-0"
            >
              {page}
            </Button>
          )
        )}
        {edge(
          Math.min(totalPages, currentPage + 1),
          'Nästa sida',
          <ChevronRight className="h-4 w-4" />
        )}
        {edge(totalPages, 'Sista sidan', <ChevronsRight className="h-4 w-4" />)}
      </div>
    </nav>
  )
}
