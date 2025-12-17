import { useState } from 'react'
import { Plus, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/v2/Button'
import { useComponentEntity } from '@/components/hooks/useComponentEntity'
import { useComponentEntityMutation } from '@/components/hooks/useComponentEntityMutation'
import { useDebounce } from '@/components/hooks/useDebounce'
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

type ViewState =
  | { level: 'categories' }
  | { level: 'types'; categoryId: string; categoryName: string }
  | {
      level: 'subtypes'
      typeId: string
      typeName: string
      categoryId: string
      categoryName: string
    }
  | {
      level: 'models'
      subtypeId: string
      subtypeName: string
      typeId: string
      typeName: string
      categoryId: string
      categoryName: string
    }
  | {
      level: 'instances'
      modelId: string
      modelName: string
      subtypeId: string
      subtypeName: string
      typeId: string
      typeName: string
      categoryId: string
      categoryName: string
    }

const ComponentLibraryView = () => {
  const [viewState, setViewState] = useState<ViewState>({ level: 'categories' })

  const [categoryDialogState, setCategoryDialogState] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    category?: ComponentCategory
  }>({
    isOpen: false,
    mode: 'create',
  })

  const [typeDialogState, setTypeDialogState] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    type?: ComponentType
  }>({
    isOpen: false,
    mode: 'create',
  })

  const [subtypeDialogState, setSubtypeDialogState] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    subtype?: ComponentSubtype
  }>({
    isOpen: false,
    mode: 'create',
  })

  const [modelDialogState, setModelDialogState] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    model?: ComponentModel
  }>({
    isOpen: false,
    mode: 'create',
  })

  const [instanceDialogState, setInstanceDialogState] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    instance?: ComponentInstance
  }>({
    isOpen: false,
    mode: 'create',
  })

  const [instanceDefaults, setInstanceDefaults] = useState<
    Record<string, any> | undefined
  >()

  const [instanceDetailsDialogState, setInstanceDetailsDialogState] = useState<{
    isOpen: boolean
    instance?: ComponentInstance
  }>({
    isOpen: false,
  })

  // Search state
  const [subtypeSearch, setSubtypeSearch] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [instanceSearch, setInstanceSearch] = useState('')
  const debouncedSubtypeSearch = useDebounce(subtypeSearch, 300)
  const debouncedModelSearch = useDebounce(modelSearch, 300)
  const debouncedInstanceSearch = useDebounce(instanceSearch, 300)

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useComponentEntity('category')
  const deleteCategory = useComponentEntityMutation('category', 'delete')

  const {
    data: types,
    isLoading: typesLoading,
    error: typesError,
  } = useComponentEntity(
    'type',
    viewState.level !== 'categories' ? viewState.categoryId : ''
  )
  const deleteType = useComponentEntityMutation('type', 'delete')

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
        debouncedSubtypeSearch.trim().length >= 2
          ? debouncedSubtypeSearch
          : undefined,
    }
  )
  const deleteSubtype = useComponentEntityMutation('subtype', 'delete')

  const {
    data: models,
    isLoading: modelsLoading,
    error: modelsError,
  } = useComponentEntity(
    'model',
    viewState.level === 'models' ? viewState.subtypeId : '',
    {
      search:
        debouncedModelSearch.trim().length >= 2
          ? debouncedModelSearch
          : undefined,
    }
  )
  const deleteModel = useComponentEntityMutation('model', 'delete')

  const {
    data: instances,
    isLoading: instancesLoading,
    error: instancesError,
  } = useComponentEntity(
    'instance',
    viewState.level === 'instances' ? viewState.modelId : '',
    {
      search:
        debouncedInstanceSearch.trim().length >= 2
          ? debouncedInstanceSearch
          : undefined,
    }
  )
  const deleteInstance = useComponentEntityMutation('instance', 'delete')

  // Category handlers
  const handleCreateCategory = () => {
    setCategoryDialogState({
      isOpen: true,
      mode: 'create',
      category: undefined,
    })
  }

  const handleEditCategory = (category: ComponentCategory) => {
    setCategoryDialogState({
      isOpen: true,
      mode: 'edit',
      category,
    })
  }

  const handleDeleteCategory = async (category: ComponentCategory) => {
    if (
      window.confirm(
        `Är du säker på att du vill ta bort kategorin "${category.categoryName}"?`
      )
    ) {
      try {
        await deleteCategory.mutateAsync({ id: category.id })
      } catch (error) {
        console.error('Error deleting category:', error)
        alert('Det gick inte att ta bort kategorin. Den kan ha kopplade typer.')
      }
    }
  }

  const handleNavigateToTypes = (category: ComponentCategory) => {
    setViewState({
      level: 'types',
      categoryId: category.id,
      categoryName: category.categoryName,
    })
  }

  const handleCloseCategoryDialog = () => {
    setCategoryDialogState({
      isOpen: false,
      mode: 'create',
      category: undefined,
    })
  }

  // Type handlers
  const handleCreateType = () => {
    setTypeDialogState({
      isOpen: true,
      mode: 'create',
      type: undefined,
    })
  }

  const handleEditType = (type: ComponentType) => {
    setTypeDialogState({
      isOpen: true,
      mode: 'edit',
      type,
    })
  }

  const handleDeleteType = async (type: ComponentType) => {
    if (viewState.level !== 'types' && viewState.level !== 'subtypes') return

    if (
      window.confirm(
        `Är du säker på att du vill ta bort typen "${type.typeName}"?`
      )
    ) {
      try {
        await deleteType.mutateAsync({
          id: type.id,
          parentId: viewState.categoryId,
        })
      } catch (error) {
        console.error('Error deleting type:', error)
        alert(
          'Det gick inte att ta bort typen. Den kan ha kopplade undertyper.'
        )
      }
    }
  }

  const handleNavigateToSubtypes = (type: ComponentType) => {
    if (viewState.level !== 'types') return

    setViewState({
      level: 'subtypes',
      typeId: type.id,
      typeName: type.typeName,
      categoryId: viewState.categoryId,
      categoryName: viewState.categoryName,
    })
  }

  const handleCloseTypeDialog = () => {
    setTypeDialogState({
      isOpen: false,
      mode: 'create',
      type: undefined,
    })
  }

  // Subtype handlers
  const handleCreateSubtype = () => {
    setSubtypeDialogState({
      isOpen: true,
      mode: 'create',
      subtype: undefined,
    })
  }

  const handleEditSubtype = (subtype: ComponentSubtype) => {
    setSubtypeDialogState({
      isOpen: true,
      mode: 'edit',
      subtype,
    })
  }

  const handleDeleteSubtype = async (subtype: ComponentSubtype) => {
    if (viewState.level !== 'subtypes') return

    if (
      window.confirm(
        `Är du säker på att du vill ta bort undertypen "${subtype.subTypeName}"?`
      )
    ) {
      try {
        await deleteSubtype.mutateAsync({
          id: subtype.id,
          parentId: viewState.typeId,
        })
      } catch (error) {
        console.error('Error deleting subtype:', error)
        alert('Det gick inte att ta bort undertypen.')
      }
    }
  }

  const handleNavigateToModels = (subtype: ComponentSubtype) => {
    if (viewState.level !== 'subtypes') return

    setModelSearch('') // Reset search when navigating
    setViewState({
      level: 'models',
      subtypeId: subtype.id,
      subtypeName: subtype.subTypeName,
      typeId: viewState.typeId,
      typeName: viewState.typeName,
      categoryId: viewState.categoryId,
      categoryName: viewState.categoryName,
    })
  }

  const handleCloseSubtypeDialog = () => {
    setSubtypeDialogState({
      isOpen: false,
      mode: 'create',
      subtype: undefined,
    })
  }

  // Model handlers
  const handleCreateModel = () => {
    setModelDialogState({
      isOpen: true,
      mode: 'create',
      model: undefined,
    })
  }

  const handleEditModel = (model: ComponentModel) => {
    setModelDialogState({
      isOpen: true,
      mode: 'edit',
      model,
    })
  }

  const handleDeleteModel = async (model: ComponentModel) => {
    if (viewState.level !== 'models') return

    if (
      window.confirm(
        `Är du säker på att du vill ta bort modellen "${model.modelName}"?`
      )
    ) {
      try {
        await deleteModel.mutateAsync({
          id: model.id,
          parentId: viewState.subtypeId,
        })
      } catch (error) {
        console.error('Error deleting model:', error)
        alert(
          'Det gick inte att ta bort modellen. Den kan ha kopplade instanser.'
        )
      }
    }
  }

  const handleCreateInstance = (model: ComponentModel) => {
    // Pre-fill instance data from model
    setInstanceDefaults({
      warrantyMonths: model.warrantyMonths || 0,
      priceAtPurchase: model.currentPrice || 0,
      depreciationPriceAtPurchase: model.subtype?.depreciationPrice || 0,
      economicLifespan: model.subtype?.economicLifespan || 0,
    })
    setInstanceDialogState({
      isOpen: true,
      mode: 'create',
      instance: undefined,
    })
  }

  const handleCloseModelDialog = () => {
    setModelDialogState({
      isOpen: false,
      mode: 'create',
      model: undefined,
    })
  }

  // Instance handlers
  const handleNavigateToInstances = (model: ComponentModel) => {
    if (viewState.level !== 'models') return

    setInstanceSearch('') // Reset search when navigating
    setViewState({
      level: 'instances',
      modelId: model.id,
      modelName: model.modelName,
      subtypeId: viewState.subtypeId,
      subtypeName: viewState.subtypeName,
      typeId: viewState.typeId,
      typeName: viewState.typeName,
      categoryId: viewState.categoryId,
      categoryName: viewState.categoryName,
    })
  }

  const handleCreateInstanceFromTable = () => {
    if (viewState.level !== 'instances') return

    setInstanceDefaults(undefined) // Clear any pre-filled values
    setInstanceDialogState({
      isOpen: true,
      mode: 'create',
      instance: undefined,
    })
  }

  const handleEditInstance = (instance: ComponentInstance) => {
    setInstanceDialogState({
      isOpen: true,
      mode: 'edit',
      instance,
    })
  }

  const handleDeleteInstance = async (instance: ComponentInstance) => {
    if (viewState.level !== 'instances') return

    if (
      window.confirm(
        `Är du säker på att du vill ta bort instansen "${instance.serialNumber}"?`
      )
    ) {
      try {
        await deleteInstance.mutateAsync({
          id: instance.id,
          parentId: viewState.modelId,
        })
      } catch (error) {
        console.error('Error deleting instance:', error)
        alert('Det gick inte att ta bort instansen.')
      }
    }
  }

  const handleViewHistory = (instance: ComponentInstance) => {
    setInstanceDetailsDialogState({
      isOpen: true,
      instance,
    })
  }

  const handleCloseInstanceDialog = () => {
    setInstanceDialogState({
      isOpen: false,
      mode: 'create',
      instance: undefined,
    })
  }

  const handleCloseInstanceDetailsDialog = () => {
    setInstanceDetailsDialogState({
      isOpen: false,
      instance: undefined,
    })
  }

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
            searchValue={subtypeSearch}
            onSearchChange={setSubtypeSearch}
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
            searchValue={modelSearch}
            onSearchChange={setModelSearch}
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
            searchValue={instanceSearch}
            onSearchChange={setInstanceSearch}
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

  const renderBreadcrumb = () => {
    if (viewState.level === 'categories') {
      return <span className="font-medium">Kategorier</span>
    }

    if (viewState.level === 'types') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewState({ level: 'categories' })}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Kategorier
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{viewState.categoryName}</span>
        </div>
      )
    }

    if (viewState.level === 'subtypes') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewState({ level: 'categories' })}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Kategorier
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() =>
              setViewState({
                level: 'types',
                categoryId: viewState.categoryId,
                categoryName: viewState.categoryName,
              })
            }
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {viewState.categoryName}
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{viewState.typeName}</span>
        </div>
      )
    }

    if (viewState.level === 'models') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewState({ level: 'categories' })}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Kategorier
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() =>
              setViewState({
                level: 'types',
                categoryId: viewState.categoryId,
                categoryName: viewState.categoryName,
              })
            }
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {viewState.categoryName}
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() =>
              setViewState({
                level: 'subtypes',
                typeId: viewState.typeId,
                typeName: viewState.typeName,
                categoryId: viewState.categoryId,
                categoryName: viewState.categoryName,
              })
            }
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {viewState.typeName}
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{viewState.subtypeName}</span>
        </div>
      )
    }

    if (viewState.level === 'instances') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewState({ level: 'categories' })}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Kategorier
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() =>
              setViewState({
                level: 'types',
                categoryId: viewState.categoryId,
                categoryName: viewState.categoryName,
              })
            }
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {viewState.categoryName}
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() =>
              setViewState({
                level: 'subtypes',
                typeId: viewState.typeId,
                typeName: viewState.typeName,
                categoryId: viewState.categoryId,
                categoryName: viewState.categoryName,
              })
            }
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {viewState.typeName}
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() =>
              setViewState({
                level: 'models',
                subtypeId: viewState.subtypeId,
                subtypeName: viewState.subtypeName,
                typeId: viewState.typeId,
                typeName: viewState.typeName,
                categoryId: viewState.categoryId,
                categoryName: viewState.categoryName,
              })
            }
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {viewState.subtypeName}
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{viewState.modelName}</span>
        </div>
      )
    }
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
        isOpen={categoryDialogState.isOpen}
        onClose={handleCloseCategoryDialog}
        entityType="category"
        entity={categoryDialogState.category}
        mode={categoryDialogState.mode}
      />

      {viewState.level === 'types' ||
      viewState.level === 'subtypes' ||
      viewState.level === 'models' ? (
        <GenericEntityDialog
          isOpen={typeDialogState.isOpen}
          onClose={handleCloseTypeDialog}
          entityType="type"
          entity={typeDialogState.type}
          parentId={viewState.categoryId}
          mode={typeDialogState.mode}
        />
      ) : null}

      {viewState.level === 'subtypes' || viewState.level === 'models' ? (
        <GenericEntityDialog
          isOpen={subtypeDialogState.isOpen}
          onClose={handleCloseSubtypeDialog}
          entityType="subtype"
          entity={subtypeDialogState.subtype}
          parentId={viewState.typeId}
          mode={subtypeDialogState.mode}
        />
      ) : null}

      {viewState.level === 'models' ? (
        <GenericEntityDialog
          isOpen={modelDialogState.isOpen}
          onClose={handleCloseModelDialog}
          entityType="model"
          entity={modelDialogState.model}
          parentId={viewState.subtypeId}
          mode={modelDialogState.mode}
        />
      ) : null}

      {viewState.level === 'instances' ? (
        <>
          <GenericEntityDialog
            isOpen={instanceDialogState.isOpen}
            onClose={handleCloseInstanceDialog}
            entityType="instance"
            entity={
              instanceDialogState.mode === 'edit'
                ? instanceDialogState.instance
                : undefined
            }
            defaultValues={
              instanceDialogState.mode === 'create'
                ? instanceDefaults
                : undefined
            }
            parentId={viewState.modelId}
            mode={instanceDialogState.mode}
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
