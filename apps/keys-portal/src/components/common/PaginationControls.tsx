import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { PaginationMeta } from '@/hooks/usePagination'

interface PaginationControlsProps {
  paginationMeta: PaginationMeta
  pageLimit: number
  customLimit: string
  isFocused: boolean
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  onCustomLimitChange: (value: string) => void
  onCustomLimitSubmit: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onFocusChange: (focused: boolean) => void
}

export function PaginationControls({
  paginationMeta,
  pageLimit,
  customLimit,
  isFocused,
  onPageChange,
  onLimitChange,
  onCustomLimitChange,
  onCustomLimitSubmit,
  onFocusChange,
}: PaginationControlsProps) {
  const totalPages = Math.ceil(
    paginationMeta.totalRecords / paginationMeta.limit
  )
  const currentPage = paginationMeta.page

  return (
    <div className="mt-8 space-y-4">
      <div className="relative flex items-center justify-center">
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => onPageChange(currentPage - 1)}
                  className={
                    currentPage <= 1
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>

              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1
                // Show first page, last page, current page, and pages around current
                const showPage =
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  Math.abs(pageNum - currentPage) <= 1

                if (!showPage) {
                  // Show ellipsis for gaps
                  if (
                    pageNum === currentPage - 2 ||
                    pageNum === currentPage + 2
                  ) {
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                  }
                  return null
                }

                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => onPageChange(pageNum)}
                      isActive={pageNum === currentPage}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => onPageChange(currentPage + 1)}
                  className={
                    currentPage >= totalPages
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}

        <div className="absolute right-0 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Items per page:</span>
          <Button
            variant={pageLimit === 60 ? 'default' : 'outline'}
            size="sm"
            onClick={() => onLimitChange(60)}
          >
            60
          </Button>
          <Button
            variant={pageLimit === 100 ? 'default' : 'outline'}
            size="sm"
            onClick={() => onLimitChange(100)}
          >
            100
          </Button>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={
              !isFocused &&
              pageLimit !== 60 &&
              pageLimit !== 100 &&
              customLimit === ''
                ? pageLimit.toString()
                : customLimit
            }
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '')
              onCustomLimitChange(val)
            }}
            onFocus={() => {
              onFocusChange(true)
              if (pageLimit !== 60 && pageLimit !== 100 && customLimit === '') {
                onCustomLimitChange(pageLimit.toString())
              }
            }}
            onBlur={() => {
              onFocusChange(false)
            }}
            onKeyDown={onCustomLimitSubmit}
            placeholder="Antal"
            className={`w-24 h-8 px-3 text-xs font-medium text-center rounded-md ${pageLimit !== 60 && pageLimit !== 100 ? 'bg-primary text-primary-foreground placeholder:text-primary-foreground/70 border-primary shadow focus-visible:ring-0 focus-visible:ring-offset-0' : ''}`}
          />
        </div>
      </div>

      {paginationMeta.totalRecords > 0 && (
        <div className="flex justify-center">
          <span className="text-sm text-muted-foreground">
            {(paginationMeta.page - 1) * paginationMeta.limit + 1}-
            {Math.min(
              paginationMeta.page * paginationMeta.limit,
              paginationMeta.totalRecords
            )}{' '}
            of {paginationMeta.totalRecords}
          </span>
        </div>
      )}
    </div>
  )
}
