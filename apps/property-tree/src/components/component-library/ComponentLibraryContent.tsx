import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/v2/Button'
import { CategoriesTable } from '@/components/component-library/CategoriesTable'
import { TypesTable } from '@/components/component-library/TypesTable'
import { SubtypesTable } from '@/components/component-library/SubtypesTable'
import { ModelsTable } from '@/components/component-library/ModelsTable'
import { InstancesTable } from '@/components/component-library/InstancesTable'
import { TableToolbar } from '@/components/component-library/TableToolbar'
import type { ViewState } from '@/components/hooks/useComponentLibraryHandlers'
import type {
  ComponentCategory,
  ComponentType,
  ComponentSubtype,
  ComponentModel,
  Component,
} from '@/services/types'

interface ComponentLibraryContentProps {
  viewState: ViewState
  searchInput: string
  onSearchChange: (value: string) => void

  // Category level
  categories: ComponentCategory[] | undefined
  categoriesLoading: boolean
  categoriesError: Error | null
  onCreateCategory: () => void
  onEditCategory: (category: ComponentCategory) => void
  onDeleteCategory: (category: ComponentCategory) => void
  onNavigateToTypes: (category: ComponentCategory) => void

  // Type level
  types: ComponentType[] | undefined
  typesLoading: boolean
  typesError: Error | null
  onCreateType: () => void
  onEditType: (type: ComponentType) => void
  onDeleteType: (type: ComponentType) => void
  onNavigateToSubtypes: (type: ComponentType) => void

  // Subtype level
  subtypes: ComponentSubtype[] | undefined
  subtypesLoading: boolean
  subtypesError: Error | null
  onCreateSubtype: () => void
  onEditSubtype: (subtype: ComponentSubtype) => void
  onDeleteSubtype: (subtype: ComponentSubtype) => void
  onNavigateToModels: (subtype: ComponentSubtype) => void

  // Model level
  models: ComponentModel[] | undefined
  modelsLoading: boolean
  modelsError: Error | null
  onCreateModel: () => void
  onEditModel: (model: ComponentModel) => void
  onDeleteModel: (model: ComponentModel) => void
  onCreateInstance: (model: ComponentModel) => void
  onNavigateToInstances: (model: ComponentModel) => void

  // Instance level
  instances: Component[] | undefined
  instancesLoading: boolean
  instancesError: Error | null
  onCreateInstanceFromTable: () => void
  onEditInstance: (instance: Component) => void
  onDeleteInstance: (instance: Component) => void
  onViewHistory: (instance: Component) => void
  onUninstall: (instance: Component) => void
}

// Error state component
const ErrorState = ({ message }: { message: string }) => (
  <div className="text-center py-10 space-y-4">
    <h2 className="text-2xl font-bold text-destructive">Ett fel uppstod</h2>
    <p className="text-muted-foreground">{message}</p>
  </div>
)

// Empty state component
const EmptyState = ({
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
  <div className="text-center py-16 space-y-4">
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="text-muted-foreground">{description}</p>
    {onAction && actionLabel && (
      <Button onClick={onAction} className="mt-4">
        <Plus className="h-4 w-4 mr-2" />
        {actionLabel}
      </Button>
    )}
  </div>
)

// No results state component
const NoResultsState = () => (
  <div className="text-center py-16 space-y-4">
    <h2 className="text-xl font-medium text-muted-foreground">
      Inga resultat matchar sökningen
    </h2>
    <p className="text-muted-foreground">Försök med en annan sökterm</p>
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
  onCreateCategory,
  onEditCategory,
  onDeleteCategory,
  onNavigateToTypes,
  // Types
  types,
  typesLoading,
  typesError,
  onCreateType,
  onEditType,
  onDeleteType,
  onNavigateToSubtypes,
  // Subtypes
  subtypes,
  subtypesLoading,
  subtypesError,
  onCreateSubtype,
  onEditSubtype,
  onDeleteSubtype,
  onNavigateToModels,
  // Models
  models,
  modelsLoading,
  modelsError,
  onCreateModel,
  onEditModel,
  onDeleteModel,
  onCreateInstance,
  onNavigateToInstances,
  // Instances
  instances,
  instancesLoading,
  instancesError,
  onCreateInstanceFromTable,
  onEditInstance,
  onDeleteInstance,
  onViewHistory,
  onUninstall,
}: ComponentLibraryContentProps) => {
  const hasActiveSearch = searchInput.trim().length > 0

  // Categories view
  if (viewState.level === 'categories') {
    if (categoriesError) {
      return (
        <ErrorState message="Kunde inte ladda kategorier. Försök igen senare." />
      )
    }

    if (!categoriesLoading && (!categories || categories.length === 0)) {
      return (
        <EmptyState
          title="Inga kategorier ännu"
          description="Skapa din första komponentkategori för att komma igång"
          onAction={onCreateCategory}
          actionLabel="Skapa kategori"
        />
      )
    }

    return (
      <>
        <TableToolbar
          onAddNew={onCreateCategory}
          addNewLabel="Ny kategori"
          itemCount={categories?.length}
          levelName="kategorier"
        />
        <CategoriesTable
          categories={categories || []}
          isLoading={categoriesLoading}
          onEdit={onEditCategory}
          onDelete={onDeleteCategory}
          onNavigate={onNavigateToTypes}
        />
      </>
    )
  }

  // Types view
  if (viewState.level === 'types') {
    if (typesError) {
      return (
        <ErrorState message="Kunde inte ladda typer. Försök igen senare." />
      )
    }

    if (!typesLoading && (!types || types.length === 0)) {
      return (
        <EmptyState
          title="Inga typer ännu"
          description="Skapa din första komponenttyp för att komma igång"
          onAction={onCreateType}
          actionLabel="Skapa typ"
        />
      )
    }

    return (
      <>
        <TableToolbar
          onAddNew={onCreateType}
          addNewLabel="Ny typ"
          itemCount={types?.length}
          levelName="typer"
        />
        <TypesTable
          types={types || []}
          isLoading={typesLoading}
          onEdit={onEditType}
          onDelete={onDeleteType}
          onNavigate={onNavigateToSubtypes}
        />
      </>
    )
  }

  // Subtypes view
  if (viewState.level === 'subtypes') {
    if (subtypesError) {
      return (
        <ErrorState message="Kunde inte ladda undertyper. Försök igen senare." />
      )
    }

    if (
      !subtypesLoading &&
      (!subtypes || subtypes.length === 0) &&
      !hasActiveSearch
    ) {
      return (
        <EmptyState
          title="Inga undertyper ännu"
          description="Skapa din första undertyp för att komma igång"
          onAction={onCreateSubtype}
          actionLabel="Skapa undertyp"
        />
      )
    }

    return (
      <>
        <TableToolbar
          onAddNew={onCreateSubtype}
          addNewLabel="Ny undertyp"
          itemCount={subtypes?.length}
          levelName="undertyper"
          searchValue={searchInput}
          onSearchChange={onSearchChange}
          searchPlaceholder="Sök efter undertyp..."
        />
        {!subtypesLoading && subtypes?.length === 0 && hasActiveSearch ? (
          <NoResultsState />
        ) : (
          <SubtypesTable
            subtypes={subtypes || []}
            isLoading={subtypesLoading}
            onEdit={onEditSubtype}
            onDelete={onDeleteSubtype}
            onNavigate={onNavigateToModels}
          />
        )}
      </>
    )
  }

  // Models view
  if (viewState.level === 'models') {
    if (modelsError) {
      return (
        <ErrorState message="Kunde inte ladda modeller. Försök igen senare." />
      )
    }

    if (
      !modelsLoading &&
      (!models || models.length === 0) &&
      !hasActiveSearch
    ) {
      return (
        <EmptyState
          title="Inga modeller ännu"
          description="Skapa din första modell för att komma igång"
          onAction={onCreateModel}
          actionLabel="Skapa modell"
        />
      )
    }

    return (
      <>
        <TableToolbar
          onAddNew={onCreateModel}
          addNewLabel="Ny modell"
          itemCount={models?.length}
          levelName="modeller"
          searchValue={searchInput}
          onSearchChange={onSearchChange}
          searchPlaceholder="Sök efter modell eller tillverkare..."
        />
        {!modelsLoading && models?.length === 0 && hasActiveSearch ? (
          <NoResultsState />
        ) : (
          <ModelsTable
            models={models || []}
            isLoading={modelsLoading}
            onEdit={onEditModel}
            onDelete={onDeleteModel}
            onNavigate={onNavigateToInstances}
            onCreateInstance={onCreateInstance}
          />
        )}
      </>
    )
  }

  // Instances view
  if (viewState.level === 'instances') {
    if (instancesError) {
      return (
        <ErrorState message="Kunde inte ladda komponenter. Försök igen senare." />
      )
    }

    if (
      !instancesLoading &&
      (!instances || instances.length === 0) &&
      !hasActiveSearch
    ) {
      return (
        <EmptyState
          title="Inga komponenter ännu"
          description="Skapa din första komponent för att komma igång"
          onAction={onCreateInstanceFromTable}
          actionLabel="Skapa komponent"
        />
      )
    }

    return (
      <>
        <TableToolbar
          onAddNew={onCreateInstanceFromTable}
          addNewLabel="Ny komponent"
          itemCount={instances?.length}
          levelName="komponenter"
          searchValue={searchInput}
          onSearchChange={onSearchChange}
          searchPlaceholder="Sök efter serienummer..."
        />
        {!instancesLoading && instances?.length === 0 && hasActiveSearch ? (
          <NoResultsState />
        ) : (
          <InstancesTable
            instances={instances || []}
            isLoading={instancesLoading}
            onEdit={onEditInstance}
            onDelete={onDeleteInstance}
            onViewHistory={onViewHistory}
            onUninstall={onUninstall}
          />
        )}
      </>
    )
  }

  return null
}
