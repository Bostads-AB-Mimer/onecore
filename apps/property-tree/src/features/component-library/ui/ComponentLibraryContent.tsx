import { Plus, RotateCw } from 'lucide-react'

import type {
  ComponentCategory,
  ComponentSubtype,
  ComponentType,
} from '@/services/types'

import { Button } from '@/shared/ui/Button'
import { TableToolbar } from '@/shared/ui/TableToolbar'

import type { ViewState } from '../hooks/useComponentLibraryHandlers'
import { levelSearch } from '../lib/libraryUrlState'
import { CategoriesTable } from './CategoriesTable'
import { SubtypesTable } from './SubtypesTable'
import { TypesTable } from './TypesTable'

interface ComponentLibraryContentProps {
  viewState: ViewState
  searchInput: string
  onSearchChange: (value: string) => void

  // Category level
  categories: ComponentCategory[] | undefined
  categoriesLoading: boolean
  categoriesError: Error | null
  onRetryCategories: () => void
  onCreateCategory: () => void
  onEditCategory: (category: ComponentCategory) => void
  onDeleteCategory: (category: ComponentCategory) => void
  onNavigateToTypes: (category: ComponentCategory) => void

  // Type level
  types: ComponentType[] | undefined
  typesLoading: boolean
  typesError: Error | null
  onRetryTypes: () => void
  onCreateType: () => void
  onEditType: (type: ComponentType) => void
  onDeleteType: (type: ComponentType) => void
  onNavigateToSubtypes: (type: ComponentType) => void

  // Subtype level
  subtypes: ComponentSubtype[] | undefined
  subtypesLoading: boolean
  subtypesError: Error | null
  onRetrySubtypes: () => void
  onCreateSubtype: () => void
  onEditSubtype: (subtype: ComponentSubtype) => void
  onDeleteSubtype: (subtype: ComponentSubtype) => void
  onOpenSubtype: (subtype: ComponentSubtype) => void
}

export const ErrorState = ({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) => (
  <div className="text-center py-12 space-y-3" role="alert">
    <h2 className="text-lg font-semibold">{message}</h2>
    <p className="text-sm text-muted-foreground">
      Kontrollera anslutningen och försök igen.
    </p>
    {onRetry && (
      <Button variant="outline" onClick={onRetry}>
        <RotateCw className="h-4 w-4 mr-2" />
        Försök igen
      </Button>
    )}
  </div>
)

export const EmptyState = ({
  title,
  description,
  onAction,
  actionLabel,
}: {
  title: string
  description: string
  onAction?: () => void
  actionLabel?: string
}) => (
  <div className="text-center py-16 space-y-3">
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="text-sm text-muted-foreground max-w-md mx-auto">
      {description}
    </p>
    {onAction && actionLabel && (
      <Button onClick={onAction} className="mt-2">
        <Plus className="h-4 w-4 mr-2" />
        {actionLabel}
      </Button>
    )}
  </div>
)

export const LoadingRows = () => (
  <div className="animate-pulse space-y-3 py-4" aria-busy="true">
    <span className="sr-only">Laddar…</span>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-12 bg-secondary rounded-md" />
    ))}
  </div>
)

export const NoResultsState = ({ onClear }: { onClear?: () => void }) => (
  <div className="text-center py-16 space-y-3" role="status">
    <h2 className="text-lg font-semibold">Inga träffar</h2>
    <p className="text-sm text-muted-foreground">
      Inget matchar sökningen eller filtret.
    </p>
    {onClear && (
      <Button variant="outline" onClick={onClear}>
        Rensa sökning och filter
      </Button>
    )}
  </div>
)

export const ComponentLibraryContent = ({
  viewState,
  searchInput,
  onSearchChange,
  // Categories
  categories,
  categoriesLoading,
  categoriesError,
  onRetryCategories,
  onCreateCategory,
  onEditCategory,
  onDeleteCategory,
  onNavigateToTypes,
  // Types
  types,
  typesLoading,
  typesError,
  onRetryTypes,
  onCreateType,
  onEditType,
  onDeleteType,
  onNavigateToSubtypes,
  // Subtypes
  subtypes,
  subtypesLoading,
  subtypesError,
  onRetrySubtypes,
  onCreateSubtype,
  onEditSubtype,
  onDeleteSubtype,
  onOpenSubtype,
}: ComponentLibraryContentProps) => {
  const hasActiveSearch = searchInput.trim().length > 0

  // Categories view
  if (viewState.level === 'categories') {
    if (categoriesError) {
      return (
        <ErrorState
          message="Kunde inte ladda kategorierna"
          onRetry={onRetryCategories}
        />
      )
    }

    if (!categoriesLoading && (!categories || categories.length === 0)) {
      return (
        <EmptyState
          title="Inga kategorier"
          description="Kategorier grupperar komponenttyper, till exempel Vitvaror eller Ytskikt."
          onAction={onCreateCategory}
          actionLabel="Skapa kategori"
        />
      )
    }

    return (
      <>
        <TableToolbar
          itemCount={categories?.length}
          levelName="kategorier"
          levelNameSingular="kategori"
        />
        <CategoriesTable
          categories={categories || []}
          isLoading={categoriesLoading}
          onEdit={onEditCategory}
          onDelete={onDeleteCategory}
          onNavigate={onNavigateToTypes}
          getHref={(category) =>
            levelSearch({
              level: 'types',
              categoryId: category.id,
              categoryName: category.categoryName,
            })
          }
        />
      </>
    )
  }

  // Types view
  if (viewState.level === 'types') {
    if (typesError) {
      return (
        <ErrorState message="Kunde inte ladda typerna" onRetry={onRetryTypes} />
      )
    }

    if (!typesLoading && (!types || types.length === 0)) {
      return (
        <EmptyState
          title="Inga typer i den här kategorin"
          description="Lägg till en typ, till exempel Spis eller Kyl."
          onAction={onCreateType}
          actionLabel="Skapa typ"
        />
      )
    }

    return (
      <>
        <TableToolbar
          itemCount={types?.length}
          levelName="typer"
          levelNameSingular="typ"
        />
        <TypesTable
          types={types || []}
          isLoading={typesLoading}
          onEdit={onEditType}
          onDelete={onDeleteType}
          onNavigate={onNavigateToSubtypes}
          getHref={(type) =>
            levelSearch({
              level: 'subtypes',
              categoryId: viewState.categoryId,
              categoryName: viewState.categoryName,
              typeId: type.id,
              typeName: type.typeName,
            })
          }
        />
      </>
    )
  }

  // Subtypes view
  if (viewState.level === 'subtypes') {
    if (subtypesError) {
      return (
        <ErrorState
          message="Kunde inte ladda undertyperna"
          onRetry={onRetrySubtypes}
        />
      )
    }

    if (
      !subtypesLoading &&
      (!subtypes || subtypes.length === 0) &&
      !hasActiveSearch
    ) {
      return (
        <EmptyState
          title="Inga undertyper för den här typen"
          description="Lägg till en undertyp för att kunna registrera komponenter av typen."
          onAction={onCreateSubtype}
          actionLabel="Skapa undertyp"
        />
      )
    }

    return (
      <>
        <TableToolbar
          itemCount={subtypes?.length}
          levelName="undertyper"
          levelNameSingular="undertyp"
          searchValue={searchInput}
          onSearchChange={onSearchChange}
          searchPlaceholder="Sök efter undertyp..."
        />
        {!subtypesLoading && subtypes?.length === 0 && hasActiveSearch ? (
          <NoResultsState onClear={() => onSearchChange('')} />
        ) : (
          <SubtypesTable
            subtypes={subtypes || []}
            isLoading={subtypesLoading}
            onEdit={onEditSubtype}
            onDelete={onDeleteSubtype}
            onNavigate={onOpenSubtype}
            getHref={(subtype) =>
              levelSearch({
                ...viewState,
                level: 'subtype',
                subtypeId: subtype.id,
                subtypeName: subtype.subTypeName,
                tab: 'components',
              })
            }
          />
        )}
      </>
    )
  }

  return null
}
