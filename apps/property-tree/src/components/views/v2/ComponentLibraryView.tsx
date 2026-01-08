import { useState, Fragment, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/v2/Button'
import { useComponentEntity } from '@/components/hooks/useComponentEntity'
import { useDebounce } from '@/components/hooks/useDebounce'
import {
  useComponentLibraryHandlers,
  type ViewState,
} from '@/components/hooks/useComponentLibraryHandlers'
import { CategoryCard } from '@/components/component-library/CategoryCard'
import { TypeCard } from '@/components/component-library/TypeCard'
import { SubtypesTable } from '@/components/component-library/SubtypesTable'
import { ModelsTable } from '@/components/component-library/ModelsTable'
import { InstancesTable } from '@/components/component-library/InstancesTable'
import { TableToolbar } from '@/components/component-library/TableToolbar'
import { GenericEntityDialog } from '@/components/component-library/dialogs/GenericEntityDialog'
import { InstanceDetailsDialog } from '@/components/component-library/dialogs/InstanceDetailsDialog'
import type {
  ComponentCategory,
  ComponentType,
  ComponentSubtype,
  ComponentModel,
  ComponentInstance,
} from '@/services/types'

// Helper function to create dialog state management
function useDialogState<T>() {
  const [state, setState] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    entity?: T
    defaultValues?: Record<string, any>
  }>({ isOpen: false, mode: 'create' })

  return {
    state,
    openCreate: (defaultValues?: Record<string, any>) =>
      setState({
        isOpen: true,
        mode: 'create',
        entity: undefined,
        defaultValues,
      }),
    openEdit: (entity: T) =>
      setState({
        isOpen: true,
        mode: 'edit',
        entity,
        defaultValues: undefined,
      }),
    close: () =>
      setState({
        isOpen: false,
        mode: 'create',
        entity: undefined,
        defaultValues: undefined,
      }),
  }
}

// Helper function to derive ViewState from URL search params
function deriveViewStateFromParams(searchParams: URLSearchParams): ViewState {
  const level = searchParams.get('level') || 'categories'

  if (level === 'types') {
    const categoryId = searchParams.get('categoryId')
    const categoryName = searchParams.get('categoryName')
    if (categoryId && categoryName) {
      return { level: 'types', categoryId, categoryName }
    }
  }

  if (level === 'subtypes') {
    const categoryId = searchParams.get('categoryId')
    const categoryName = searchParams.get('categoryName')
    const typeId = searchParams.get('typeId')
    const typeName = searchParams.get('typeName')
    if (categoryId && categoryName && typeId && typeName) {
      return { level: 'subtypes', categoryId, categoryName, typeId, typeName }
    }
  }

  if (level === 'models') {
    const categoryId = searchParams.get('categoryId')
    const categoryName = searchParams.get('categoryName')
    const typeId = searchParams.get('typeId')
    const typeName = searchParams.get('typeName')
    const subtypeId = searchParams.get('subtypeId')
    const subtypeName = searchParams.get('subtypeName')
    if (
      categoryId &&
      categoryName &&
      typeId &&
      typeName &&
      subtypeId &&
      subtypeName
    ) {
      return {
        level: 'models',
        categoryId,
        categoryName,
        typeId,
        typeName,
        subtypeId,
        subtypeName,
      }
    }
  }

  if (level === 'instances') {
    const categoryId = searchParams.get('categoryId')
    const categoryName = searchParams.get('categoryName')
    const typeId = searchParams.get('typeId')
    const typeName = searchParams.get('typeName')
    const subtypeId = searchParams.get('subtypeId')
    const subtypeName = searchParams.get('subtypeName')
    const modelId = searchParams.get('modelId')
    const modelName = searchParams.get('modelName')
    if (
      categoryId &&
      categoryName &&
      typeId &&
      typeName &&
      subtypeId &&
      subtypeName &&
      modelId &&
      modelName
    ) {
      return {
        level: 'instances',
        categoryId,
        categoryName,
        typeId,
        typeName,
        subtypeId,
        subtypeName,
        modelId,
        modelName,
      }
    }
  }

  // Default to categories
  return { level: 'categories' }
}

// Helper function to create URL params from ViewState
function createParamsFromViewState(
  state: ViewState,
  search?: string
): URLSearchParams {
  const params = new URLSearchParams()

  if (state.level === 'categories') {
    // No params needed for categories
    return params
  }

  params.set('level', state.level)
  params.set('categoryId', state.categoryId)
  params.set('categoryName', state.categoryName)

  if (
    state.level === 'subtypes' ||
    state.level === 'models' ||
    state.level === 'instances'
  ) {
    params.set('typeId', state.typeId)
    params.set('typeName', state.typeName)
  }

  if (state.level === 'models' || state.level === 'instances') {
    params.set('subtypeId', state.subtypeId)
    params.set('subtypeName', state.subtypeName)
  }

  if (state.level === 'instances') {
    params.set('modelId', state.modelId)
    params.set('modelName', state.modelName)
  }

  if (search && search.trim()) {
    params.set('search', search.trim())
  }

  return params
}

const ComponentLibraryView = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  // Derive viewState from URL params
  const viewState = useMemo(
    () => deriveViewStateFromParams(searchParams),
    [searchParams]
  )

  // Local search input state for immediate feedback
  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') || ''
  )

  // Sync search input when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    setSearchInput(urlSearch)
  }, [searchParams])

  // Debounced search for API calls
  const debouncedSearch = useDebounce(searchInput, 300)

  // Update URL when debounced search changes (only for levels that support search)
  useEffect(() => {
    if (
      viewState.level === 'subtypes' ||
      viewState.level === 'models' ||
      viewState.level === 'instances'
    ) {
      const currentSearch = searchParams.get('search') || ''
      const newSearch = debouncedSearch.trim()

      if (currentSearch !== newSearch) {
        const newParams = createParamsFromViewState(viewState, newSearch)
        setSearchParams(newParams, { replace: true })
      }
    }
  }, [debouncedSearch, viewState, searchParams, setSearchParams])

  // Navigation helper that updates URL
  const navigateTo = (newState: ViewState) => {
    const params = createParamsFromViewState(newState)
    setSearchParams(params)
    setSearchInput('') // Reset search when navigating
  }

  // Dialog states using helper
  const categoryDialog = useDialogState<ComponentCategory>()
  const typeDialog = useDialogState<ComponentType>()
  const subtypeDialog = useDialogState<ComponentSubtype>()
  const modelDialog = useDialogState<ComponentModel>()
  const instanceDialog = useDialogState<ComponentInstance>()
  const [instanceDetailsDialogState, setInstanceDetailsDialogState] = useState<{
    isOpen: boolean
    instance?: ComponentInstance
  }>({
    isOpen: false,
  })

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useComponentEntity('category')

  const {
    data: types,
    isLoading: typesLoading,
    error: typesError,
  } = useComponentEntity(
    'type',
    viewState.level !== 'categories' ? viewState.categoryId : ''
  )

  const {
    data: subtypes,
    isLoading: subtypesLoading,
    error: subtypesError,
  } = useComponentEntity(
    'subtype',
    viewState.level === 'subtypes' || viewState.level === 'models'
      ? viewState.typeId
      : '',
    {
      search:
        viewState.level === 'subtypes' && debouncedSearch.trim().length >= 2
          ? debouncedSearch
          : undefined,
    }
  )

  const {
    data: models,
    isLoading: modelsLoading,
    error: modelsError,
  } = useComponentEntity(
    'model',
    viewState.level === 'models' ? viewState.subtypeId : '',
    {
      search:
        viewState.level === 'models' && debouncedSearch.trim().length >= 2
          ? debouncedSearch
          : undefined,
    }
  )

  const {
    data: instances,
    isLoading: instancesLoading,
    error: instancesError,
  } = useComponentEntity(
    'instance',
    viewState.level === 'instances' ? viewState.modelId : '',
    {
      search:
        viewState.level === 'instances' && debouncedSearch.trim().length >= 2
          ? debouncedSearch
          : undefined,
    }
  )

  // Use handlers hook
  const {
    handleCreateCategory,
    handleEditCategory,
    handleDeleteCategory,
    handleNavigateToTypes,
    handleCreateType,
    handleEditType,
    handleDeleteType,
    handleNavigateToSubtypes,
    handleCreateSubtype,
    handleEditSubtype,
    handleDeleteSubtype,
    handleNavigateToModels,
    handleCreateModel,
    handleEditModel,
    handleDeleteModel,
    handleCreateInstance,
    handleNavigateToInstances,
    handleCreateInstanceFromTable,
    handleEditInstance,
    handleDeleteInstance,
    handleViewHistory,
    handleCloseInstanceDetailsDialog,
  } = useComponentLibraryHandlers({
    viewState,
    navigateTo,
    setInstanceDetailsDialogState,
    categoryDialog,
    typeDialog,
    subtypeDialog,
    modelDialog,
    instanceDialog,
  })

  const renderContent = () => {
    // Categories view
    if (viewState.level === 'categories') {
      if (categoriesLoading) {
        return (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-secondary rounded-lg"></div>
            ))}
          </div>
        )
      }

      if (categoriesError) {
        return (
          <div className="text-center py-10 space-y-4">
            <h2 className="text-2xl font-bold text-destructive">
              Ett fel uppstod
            </h2>
            <p className="text-muted-foreground">
              Kunde inte ladda kategorier. Försök igen senare.
            </p>
          </div>
        )
      }

      if (!categories || categories.length === 0) {
        return (
          <div className="text-center py-16 space-y-4">
            <h2 className="text-2xl font-bold">Inga kategorier ännu</h2>
            <p className="text-muted-foreground">
              Skapa din första komponentkategori för att komma igång
            </p>
            <Button onClick={handleCreateCategory} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Skapa kategori
            </Button>
          </div>
        )
      }

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={() => handleEditCategory(category)}
              onDelete={() => handleDeleteCategory(category)}
              onNavigate={() => handleNavigateToTypes(category)}
            />
          ))}
        </div>
      )
    }

    // Types view
    if (viewState.level === 'types') {
      if (typesLoading) {
        return (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-secondary rounded-lg"></div>
            ))}
          </div>
        )
      }

      if (typesError) {
        return (
          <div className="text-center py-10 space-y-4">
            <h2 className="text-2xl font-bold text-destructive">
              Ett fel uppstod
            </h2>
            <p className="text-muted-foreground">
              Kunde inte ladda typer. Försök igen senare.
            </p>
          </div>
        )
      }

      if (!types || types.length === 0) {
        return (
          <div className="text-center py-16 space-y-4">
            <h2 className="text-2xl font-bold">Inga typer ännu</h2>
            <p className="text-muted-foreground">
              Skapa din första komponenttyp för att komma igång
            </p>
            <Button onClick={handleCreateType} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Skapa typ
            </Button>
          </div>
        )
      }

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {types.map((type) => (
            <TypeCard
              key={type.id}
              type={type}
              onEdit={() => handleEditType(type)}
              onDelete={() => handleDeleteType(type)}
              onNavigate={() => handleNavigateToSubtypes(type)}
            />
          ))}
        </div>
      )
    }

    // Subtypes view
    if (viewState.level === 'subtypes') {
      if (subtypesError) {
        return (
          <div className="text-center py-10 space-y-4">
            <h2 className="text-2xl font-bold text-destructive">
              Ett fel uppstod
            </h2>
            <p className="text-muted-foreground">
              Kunde inte ladda undertyper. Försök igen senare.
            </p>
          </div>
        )
      }

      if (!subtypesLoading && (!subtypes || subtypes.length === 0)) {
        return (
          <div className="text-center py-16 space-y-4">
            <h2 className="text-2xl font-bold">Inga undertyper ännu</h2>
            <p className="text-muted-foreground">
              Skapa din första undertyp för att komma igång
            </p>
          </div>
        )
      }

      return (
        <>
          <TableToolbar
            onAddNew={handleCreateSubtype}
            addNewLabel="Ny undertyp"
            itemCount={subtypes?.length}
            levelName="undertyper"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Sök efter undertyp..."
          />
          <SubtypesTable
            subtypes={subtypes || []}
            isLoading={subtypesLoading}
            onEdit={handleEditSubtype}
            onDelete={handleDeleteSubtype}
            onNavigate={handleNavigateToModels}
          />
        </>
      )
    }

    // Models view
    if (viewState.level === 'models') {
      if (modelsError) {
        return (
          <div className="text-center py-10 space-y-4">
            <h2 className="text-2xl font-bold text-destructive">
              Ett fel uppstod
            </h2>
            <p className="text-muted-foreground">
              Kunde inte ladda modeller. Försök igen senare.
            </p>
          </div>
        )
      }

      if (!modelsLoading && (!models || models.length === 0)) {
        return (
          <div className="text-center py-16 space-y-4">
            <h2 className="text-2xl font-bold">Inga modeller ännu</h2>
            <p className="text-muted-foreground">
              Skapa din första modell för att komma igång
            </p>
          </div>
        )
      }

      return (
        <>
          <TableToolbar
            onAddNew={handleCreateModel}
            addNewLabel="Ny modell"
            itemCount={models?.length}
            levelName="modeller"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Sök efter modell eller tillverkare..."
          />
          <ModelsTable
            models={models || []}
            isLoading={modelsLoading}
            onEdit={handleEditModel}
            onDelete={handleDeleteModel}
            onNavigate={handleNavigateToInstances}
            onCreateInstance={handleCreateInstance}
          />
        </>
      )
    }

    // Instances view
    if (viewState.level === 'instances') {
      if (instancesError) {
        return (
          <div className="text-center py-10 space-y-4">
            <h2 className="text-2xl font-bold text-destructive">
              Ett fel uppstod
            </h2>
            <p className="text-muted-foreground">
              Kunde inte ladda instanser. Försök igen senare.
            </p>
          </div>
        )
      }

      if (!instancesLoading && (!instances || instances.length === 0)) {
        return (
          <div className="text-center py-16 space-y-4">
            <h2 className="text-2xl font-bold">Inga komponenter ännu</h2>
            <p className="text-muted-foreground">
              Skapa din första komponent för att komma igång
            </p>
            <Button onClick={handleCreateInstanceFromTable} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Skapa komponent
            </Button>
          </div>
        )
      }

      return (
        <>
          <TableToolbar
            onAddNew={handleCreateInstanceFromTable}
            addNewLabel="Ny komponent"
            itemCount={instances?.length}
            levelName="komponenter"
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Sök efter serienummer..."
          />
          <InstancesTable
            instances={instances || []}
            isLoading={instancesLoading}
            onEdit={handleEditInstance}
            onDelete={handleDeleteInstance}
            onViewHistory={handleViewHistory}
          />
        </>
      )
    }

    return null
  }

  const getBreadcrumbItems = (): Array<{
    label: string
    onClick?: () => void
  }> => {
    const items: Array<{ label: string; onClick?: () => void }> = []

    // Always start with Categories
    items.push({
      label: 'Kategorier',
      onClick:
        viewState.level !== 'categories'
          ? () => navigateTo({ level: 'categories' })
          : undefined,
    })

    if (viewState.level === 'categories') return items

    // Add category
    items.push({
      label: viewState.categoryName,
      onClick:
        viewState.level !== 'types'
          ? () =>
              navigateTo({
                level: 'types',
                categoryId: viewState.categoryId,
                categoryName: viewState.categoryName,
              })
          : undefined,
    })

    if (viewState.level === 'types') return items

    // Add type
    items.push({
      label: viewState.typeName,
      onClick:
        viewState.level !== 'subtypes'
          ? () =>
              navigateTo({
                level: 'subtypes',
                typeId: viewState.typeId,
                typeName: viewState.typeName,
                categoryId: viewState.categoryId,
                categoryName: viewState.categoryName,
              })
          : undefined,
    })

    if (viewState.level === 'subtypes') return items

    // Add subtype
    items.push({
      label: viewState.subtypeName,
      onClick:
        viewState.level !== 'models'
          ? () =>
              navigateTo({
                level: 'models',
                subtypeId: viewState.subtypeId,
                subtypeName: viewState.subtypeName,
                typeId: viewState.typeId,
                typeName: viewState.typeName,
                categoryId: viewState.categoryId,
                categoryName: viewState.categoryName,
              })
          : undefined,
    })

    if (viewState.level === 'models') return items

    // Add model (only for instances level)
    items.push({
      label: viewState.modelName,
    })

    return items
  }

  const renderBreadcrumb = () => {
    const items = getBreadcrumbItems()

    return (
      <div className="flex items-center gap-2">
        {items.map((item, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {item.onClick ? (
              <button
                onClick={item.onClick}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <span className="font-medium">{item.label}</span>
            )}
          </Fragment>
        ))}
      </div>
    )
  }

  const renderNewButton = () => {
    if (
      viewState.level === 'categories' &&
      categories &&
      categories.length > 0
    ) {
      return (
        <Button onClick={handleCreateCategory}>
          <Plus className="h-4 w-4 mr-2" />
          Ny kategori
        </Button>
      )
    }

    if (viewState.level === 'types') {
      return (
        <Button onClick={handleCreateType}>
          <Plus className="h-4 w-4 mr-2" />
          Ny typ
        </Button>
      )
    }

    // Subtypes, models, and instances buttons are in TableToolbar
    return null
  }

  return (
    <div className="py-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Komponentbibliotek</h1>
          <p className="text-muted-foreground mt-1">
            Hantera komponenter, modeller och installationer
          </p>
        </div>
        {renderNewButton()}
      </div>

      {/* Breadcrumb Navigation */}
      <div className="text-sm text-muted-foreground">{renderBreadcrumb()}</div>

      {/* Content */}
      {renderContent()}

      {/* Dialogs */}
      <GenericEntityDialog
        isOpen={categoryDialog.state.isOpen}
        onClose={categoryDialog.close}
        entityType="category"
        entity={categoryDialog.state.entity}
        mode={categoryDialog.state.mode}
      />

      {viewState.level === 'types' ||
      viewState.level === 'subtypes' ||
      viewState.level === 'models' ? (
        <GenericEntityDialog
          isOpen={typeDialog.state.isOpen}
          onClose={typeDialog.close}
          entityType="type"
          entity={typeDialog.state.entity}
          parentId={viewState.categoryId}
          mode={typeDialog.state.mode}
        />
      ) : null}

      {viewState.level === 'subtypes' || viewState.level === 'models' ? (
        <GenericEntityDialog
          isOpen={subtypeDialog.state.isOpen}
          onClose={subtypeDialog.close}
          entityType="subtype"
          entity={subtypeDialog.state.entity}
          parentId={viewState.typeId}
          mode={subtypeDialog.state.mode}
        />
      ) : null}

      {viewState.level === 'models' ? (
        <GenericEntityDialog
          isOpen={modelDialog.state.isOpen}
          onClose={modelDialog.close}
          entityType="model"
          entity={modelDialog.state.entity}
          parentId={viewState.subtypeId}
          mode={modelDialog.state.mode}
        />
      ) : null}

      {viewState.level === 'instances' ? (
        <>
          <GenericEntityDialog
            isOpen={instanceDialog.state.isOpen}
            onClose={instanceDialog.close}
            entityType="instance"
            entity={instanceDialog.state.entity}
            defaultValues={instanceDialog.state.defaultValues}
            parentId={viewState.modelId}
            mode={instanceDialog.state.mode}
          />

          {instanceDetailsDialogState.instance && (
            <InstanceDetailsDialog
              isOpen={instanceDetailsDialogState.isOpen}
              onClose={handleCloseInstanceDetailsDialog}
              instance={instanceDetailsDialogState.instance}
            />
          )}
        </>
      ) : null}
    </div>
  )
}

export default ComponentLibraryView
