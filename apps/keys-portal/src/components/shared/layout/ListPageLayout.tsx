import { PageHeader } from './PageHeader'
import { SearchInput } from './SearchInput'
import { AddButton } from './AddButton'
import { PaginationControls } from '@/components/common/PaginationControls'
import type { useUrlPagination } from '@/hooks/useUrlPagination'

interface ListPageLayoutProps {
  /** Page title */
  title: string
  /** Subtitle showing counts */
  subtitle: string
  /** Optional badges for the header */
  badges?: React.ReactNode
  /** Search input value */
  searchValue: string
  /** Search input change handler */
  onSearchChange: (query: string) => void
  /** Search placeholder text */
  searchPlaceholder?: string
  /** Add button click handler - if omitted, no add button shown */
  onAddNew?: () => void
  /** Add button label */
  addButtonLabel?: string
  /** Pagination from useUrlPagination hook - if provided, renders pagination controls */
  pagination?: ReturnType<typeof useUrlPagination>
  /** Page content (form, table) */
  children: React.ReactNode
}

/** Shared layout for list pages with header, search, and optional add button */
export function ListPageLayout({
  title,
  subtitle,
  badges,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Sök...',
  onAddNew,
  addButtonLabel = 'Lägg till',
  pagination,
  children,
}: ListPageLayoutProps) {
  return (
    <div className="container mx-auto py-8 px-4">
      <PageHeader title={title} subtitle={subtitle} badges={badges} />

      <div className="flex items-center justify-between gap-4 mb-6">
        <SearchInput
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
        {onAddNew && <AddButton onClick={onAddNew}>{addButtonLabel}</AddButton>}
      </div>

      {children}

      {pagination && (
        <PaginationControls
          paginationMeta={pagination.paginationMeta}
          pageLimit={pagination.currentLimit}
          customLimit={pagination.customLimit}
          isFocused={pagination.isFocused}
          onPageChange={pagination.handlePageChange}
          onLimitChange={pagination.handleLimitChange}
          onCustomLimitChange={pagination.setCustomLimit}
          onCustomLimitSubmit={pagination.handleCustomLimitSubmit}
          onFocusChange={pagination.setIsFocused}
        />
      )}
    </div>
  )
}
