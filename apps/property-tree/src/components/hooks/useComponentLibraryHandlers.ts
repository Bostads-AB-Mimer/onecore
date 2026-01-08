import { useComponentEntityMutation } from './useComponentEntityMutation'
import type {
  ComponentCategory,
  ComponentType,
  ComponentSubtype,
  ComponentModel,
  ComponentInstance,
} from '@/services/types'

// ViewState type definition
export type ViewState =
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

// Parameters interface
interface UseComponentLibraryHandlersParams {
  // State
  viewState: ViewState
  navigateTo: (state: ViewState) => void
  setInstanceDetailsDialogState: (state: {
    isOpen: boolean
    instance?: ComponentInstance
  }) => void

  // Dialog controls from inline useDialogState helper
  categoryDialog: {
    openCreate: (defaultValues?: Record<string, any>) => void
    openEdit: (entity: ComponentCategory) => void
  }
  typeDialog: {
    openCreate: (defaultValues?: Record<string, any>) => void
    openEdit: (entity: ComponentType) => void
  }
  subtypeDialog: {
    openCreate: (defaultValues?: Record<string, any>) => void
    openEdit: (entity: ComponentSubtype) => void
  }
  modelDialog: {
    openCreate: (defaultValues?: Record<string, any>) => void
    openEdit: (entity: ComponentModel) => void
  }
  instanceDialog: {
    openCreate: (defaultValues?: Record<string, any>) => void
    openEdit: (entity: ComponentInstance) => void
  }
}

// Return type interface
interface ComponentLibraryHandlers {
  // Category handlers
  handleCreateCategory: () => void
  handleEditCategory: (category: ComponentCategory) => void
  handleDeleteCategory: (category: ComponentCategory) => Promise<void>
  handleNavigateToTypes: (category: ComponentCategory) => void

  // Type handlers
  handleCreateType: () => void
  handleEditType: (type: ComponentType) => void
  handleDeleteType: (type: ComponentType) => Promise<void>
  handleNavigateToSubtypes: (type: ComponentType) => void

  // Subtype handlers
  handleCreateSubtype: () => void
  handleEditSubtype: (subtype: ComponentSubtype) => void
  handleDeleteSubtype: (subtype: ComponentSubtype) => Promise<void>
  handleNavigateToModels: (subtype: ComponentSubtype) => void

  // Model handlers
  handleCreateModel: () => void
  handleEditModel: (model: ComponentModel) => void
  handleDeleteModel: (model: ComponentModel) => Promise<void>
  handleCreateInstance: (model: ComponentModel) => void
  handleNavigateToInstances: (model: ComponentModel) => void

  // Instance handlers
  handleCreateInstanceFromTable: () => void
  handleEditInstance: (instance: ComponentInstance) => void
  handleDeleteInstance: (instance: ComponentInstance) => Promise<void>
  handleViewHistory: (instance: ComponentInstance) => void
  handleCloseInstanceDetailsDialog: () => void
}

export const useComponentLibraryHandlers = (
  params: UseComponentLibraryHandlersParams
): ComponentLibraryHandlers => {
  const {
    viewState,
    navigateTo,
    setInstanceDetailsDialogState,
    categoryDialog,
    typeDialog,
    subtypeDialog,
    modelDialog,
    instanceDialog,
  } = params

  // Delete mutations
  const deleteCategory = useComponentEntityMutation('category', 'delete')
  const deleteType = useComponentEntityMutation('type', 'delete')
  const deleteSubtype = useComponentEntityMutation('subtype', 'delete')
  const deleteModel = useComponentEntityMutation('model', 'delete')
  const deleteInstance = useComponentEntityMutation('instance', 'delete')

  // Category handlers
  const handleCreateCategory = () => categoryDialog.openCreate()
  const handleEditCategory = (category: ComponentCategory) =>
    categoryDialog.openEdit(category)

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
    navigateTo({
      level: 'types',
      categoryId: category.id,
      categoryName: category.categoryName,
    })
  }

  // Type handlers
  const handleCreateType = () => typeDialog.openCreate()
  const handleEditType = (type: ComponentType) => typeDialog.openEdit(type)

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

    navigateTo({
      level: 'subtypes',
      typeId: type.id,
      typeName: type.typeName,
      categoryId: viewState.categoryId,
      categoryName: viewState.categoryName,
    })
  }

  // Subtype handlers
  const handleCreateSubtype = () => subtypeDialog.openCreate()
  const handleEditSubtype = (subtype: ComponentSubtype) =>
    subtypeDialog.openEdit(subtype)

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

    navigateTo({
      level: 'models',
      subtypeId: subtype.id,
      subtypeName: subtype.subTypeName,
      typeId: viewState.typeId,
      typeName: viewState.typeName,
      categoryId: viewState.categoryId,
      categoryName: viewState.categoryName,
    })
  }

  // Model handlers
  const handleCreateModel = () => modelDialog.openCreate()
  const handleEditModel = (model: ComponentModel) => modelDialog.openEdit(model)

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
    instanceDialog.openCreate({
      warrantyMonths: model.warrantyMonths || 0,
      priceAtPurchase: model.currentPrice || 0,
      depreciationPriceAtPurchase: model.subtype?.depreciationPrice || 0,
      economicLifespan: model.subtype?.economicLifespan || 0,
    })
  }

  const handleNavigateToInstances = (model: ComponentModel) => {
    if (viewState.level !== 'models') return

    navigateTo({
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

  // Instance handlers
  const handleCreateInstanceFromTable = () => {
    if (viewState.level !== 'instances') return
    instanceDialog.openCreate() // Clear any pre-filled values
  }

  const handleEditInstance = (instance: ComponentInstance) =>
    instanceDialog.openEdit(instance)

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

  const handleCloseInstanceDetailsDialog = () => {
    setInstanceDetailsDialogState({
      isOpen: false,
      instance: undefined,
    })
  }

  return {
    // Category handlers
    handleCreateCategory,
    handleEditCategory,
    handleDeleteCategory,
    handleNavigateToTypes,

    // Type handlers
    handleCreateType,
    handleEditType,
    handleDeleteType,
    handleNavigateToSubtypes,

    // Subtype handlers
    handleCreateSubtype,
    handleEditSubtype,
    handleDeleteSubtype,
    handleNavigateToModels,

    // Model handlers
    handleCreateModel,
    handleEditModel,
    handleDeleteModel,
    handleCreateInstance,
    handleNavigateToInstances,

    // Instance handlers
    handleCreateInstanceFromTable,
    handleEditInstance,
    handleDeleteInstance,
    handleViewHistory,
    handleCloseInstanceDetailsDialog,
  }
}
