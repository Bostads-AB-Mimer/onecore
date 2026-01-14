import { useComponentLibraryViewState } from '@/components/hooks/useComponentLibraryViewState'
import { useComponentLibraryHandlers } from '@/components/hooks/useComponentLibraryHandlers'
import { ComponentLibraryBreadcrumb } from '@/components/component-library/ComponentLibraryBreadcrumb'
import { ComponentLibraryContent } from '@/components/component-library/ComponentLibraryContent'
import { ComponentLibraryDialogs } from '@/components/component-library/ComponentLibraryDialogs'

const ComponentLibraryView = () => {
  const { viewState, navigateTo, searchInput, setSearchInput, dialogs, data } =
    useComponentLibraryViewState()

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
  } = useComponentLibraryHandlers({
    viewState,
    navigateTo,
    instanceDetailsDialog: dialogs.instanceDetailsDialog,
    categoryDialog: dialogs.categoryDialog,
    typeDialog: dialogs.typeDialog,
    subtypeDialog: dialogs.subtypeDialog,
    modelDialog: dialogs.modelDialog,
    instanceDialog: dialogs.instanceDialog,
  })

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
      </div>

      {/* Breadcrumb Navigation */}
      <div className="text-sm text-muted-foreground">
        <ComponentLibraryBreadcrumb
          viewState={viewState}
          onNavigate={navigateTo}
        />
      </div>

      {/* Content */}
      <ComponentLibraryContent
        viewState={viewState}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        // Categories
        categories={data.categories}
        categoriesLoading={data.categoriesLoading}
        categoriesError={data.categoriesError}
        onCreateCategory={handleCreateCategory}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
        onNavigateToTypes={handleNavigateToTypes}
        // Types
        types={data.types}
        typesLoading={data.typesLoading}
        typesError={data.typesError}
        onCreateType={handleCreateType}
        onEditType={handleEditType}
        onDeleteType={handleDeleteType}
        onNavigateToSubtypes={handleNavigateToSubtypes}
        // Subtypes
        subtypes={data.subtypes}
        subtypesLoading={data.subtypesLoading}
        subtypesError={data.subtypesError}
        onCreateSubtype={handleCreateSubtype}
        onEditSubtype={handleEditSubtype}
        onDeleteSubtype={handleDeleteSubtype}
        onNavigateToModels={handleNavigateToModels}
        // Models
        models={data.models}
        modelsLoading={data.modelsLoading}
        modelsError={data.modelsError}
        onCreateModel={handleCreateModel}
        onEditModel={handleEditModel}
        onDeleteModel={handleDeleteModel}
        onCreateInstance={handleCreateInstance}
        onNavigateToInstances={handleNavigateToInstances}
        // Instances
        instances={data.instances}
        instancesLoading={data.instancesLoading}
        instancesError={data.instancesError}
        onCreateInstanceFromTable={handleCreateInstanceFromTable}
        onEditInstance={handleEditInstance}
        onDeleteInstance={handleDeleteInstance}
        onViewHistory={handleViewHistory}
        onUninstall={(instance) => dialogs.deinstallDialog.open(instance)}
      />

      {/* Dialogs */}
      <ComponentLibraryDialogs
        viewState={viewState}
        categoryDialog={dialogs.categoryDialog}
        typeDialog={dialogs.typeDialog}
        subtypeDialog={dialogs.subtypeDialog}
        modelDialog={dialogs.modelDialog}
        instanceDialog={dialogs.instanceDialog}
        instanceDetailsDialog={dialogs.instanceDetailsDialog}
        deinstallDialog={dialogs.deinstallDialog}
      />
    </div>
  )
}

export default ComponentLibraryView
