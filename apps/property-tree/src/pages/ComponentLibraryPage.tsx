import {
  ComponentLibraryBreadcrumb,
  ComponentLibraryContent,
  ComponentLibraryDialogs,
  SubtypeView,
  useComponentLibraryHandlers,
  useComponentLibraryViewState,
} from '@/features/component-library'

import { ComponentImageGallery } from '@/entities/component'

import { ViewLayout } from '@/shared/ui/layout'

const ComponentLibraryPage = () => {
  const {
    viewState,
    navigateTo,
    setTab,
    setModelFilter,
    page,
    setPage,
    searchInput,
    setSearchInput,
    categoryType,
    dialogs,
    data,
  } = useComponentLibraryViewState()

  const handlers = useComponentLibraryHandlers({
    viewState,
    navigateTo,
    modelOptions: data.modelOptions,
    instanceDetailsDialog: dialogs.instanceDetailsDialog,
    categoryDialog: dialogs.categoryDialog,
    typeDialog: dialogs.typeDialog,
    subtypeDialog: dialogs.subtypeDialog,
    modelDialog: dialogs.modelDialog,
    instanceDialog: dialogs.instanceDialog,
  })

  return (
    <ViewLayout>
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
      {viewState.level === 'subtype' ? (
        <SubtypeView
          viewState={viewState}
          categoryType={categoryType}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          onTabChange={setTab}
          models={data.models}
          modelsLoading={data.modelsLoading}
          modelsError={data.modelsError}
          onCreateModel={handlers.handleCreateModel}
          onEditModel={handlers.handleEditModel}
          onDeleteModel={handlers.handleDeleteModel}
          onCreateInstance={handlers.handleCreateInstance}
          onOpenModelComponents={handlers.handleOpenModelComponents}
          modelOptions={data.modelOptions}
          componentPage={data.componentPage}
          componentsLoading={data.componentsLoading}
          componentsFetching={data.componentsFetching}
          componentsError={data.componentsError}
          page={page}
          onPageChange={setPage}
          onModelFilterChange={setModelFilter}
          onCreateComponent={handlers.handleCreateInstanceFromTable}
          onEditInstance={handlers.handleEditInstance}
          onDeleteInstance={handlers.handleDeleteInstance}
          onViewHistory={handlers.handleViewHistory}
          onUninstall={(instance) => dialogs.deinstallDialog.open(instance)}
          onViewImages={(instance) => dialogs.imageGalleryDialog.open(instance)}
        />
      ) : (
        <ComponentLibraryContent
          viewState={viewState}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          categories={data.categories}
          categoriesLoading={data.categoriesLoading}
          categoriesError={data.categoriesError}
          onCreateCategory={handlers.handleCreateCategory}
          onEditCategory={handlers.handleEditCategory}
          onDeleteCategory={handlers.handleDeleteCategory}
          onNavigateToTypes={handlers.handleNavigateToTypes}
          types={data.types}
          typesLoading={data.typesLoading}
          typesError={data.typesError}
          onCreateType={handlers.handleCreateType}
          onEditType={handlers.handleEditType}
          onDeleteType={handlers.handleDeleteType}
          onNavigateToSubtypes={handlers.handleNavigateToSubtypes}
          subtypes={data.subtypes}
          subtypesLoading={data.subtypesLoading}
          subtypesError={data.subtypesError}
          onCreateSubtype={handlers.handleCreateSubtype}
          onEditSubtype={handlers.handleEditSubtype}
          onDeleteSubtype={handlers.handleDeleteSubtype}
          onOpenSubtype={handlers.handleOpenSubtype}
        />
      )}

      {/* Dialogs */}
      <ComponentLibraryDialogs
        viewState={viewState}
        categoryType={categoryType}
        modelOptions={data.modelOptions}
        categoryDialog={dialogs.categoryDialog}
        typeDialog={dialogs.typeDialog}
        subtypeDialog={dialogs.subtypeDialog}
        modelDialog={dialogs.modelDialog}
        instanceDialog={dialogs.instanceDialog}
        instanceDetailsDialog={dialogs.instanceDetailsDialog}
        deinstallDialog={dialogs.deinstallDialog}
      />

      {/* Image Gallery Dialog */}
      {dialogs.imageGalleryDialog.state.data && (
        <ComponentImageGallery
          componentId={dialogs.imageGalleryDialog.state.data.id}
          isOpen={dialogs.imageGalleryDialog.state.isOpen}
          onClose={dialogs.imageGalleryDialog.close}
        />
      )}
    </ViewLayout>
  )
}

export default ComponentLibraryPage
