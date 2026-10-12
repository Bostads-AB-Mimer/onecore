import {
  formatComponentLabel,
  useComponentEntityMutation,
} from '@/entities/component'

import type {
  Component,
  ComponentCategory,
  ComponentModel,
  ComponentSubtype,
  ComponentType,
} from '@/services/types'

import type {
  UseDialogStateReturn,
  UseSimpleDialogStateReturn,
} from '@/shared/hooks'

import { instanceCreateDefaults } from '../lib/instanceForm'
import type { ViewState } from '../lib/libraryUrlState'

export type { ViewState } from '../lib/libraryUrlState'

// Parameters interface - uses types from useDialogState
interface UseComponentLibraryHandlersParams {
  viewState: ViewState
  navigateTo: (state: ViewState) => void
  modelOptions: ComponentModel[]
  instanceDetailsDialog: UseSimpleDialogStateReturn<Component>
  categoryDialog: Pick<
    UseDialogStateReturn<ComponentCategory>,
    'openCreate' | 'openEdit'
  >
  typeDialog: Pick<
    UseDialogStateReturn<ComponentType>,
    'openCreate' | 'openEdit'
  >
  subtypeDialog: Pick<
    UseDialogStateReturn<ComponentSubtype>,
    'openCreate' | 'openEdit'
  >
  modelDialog: Pick<
    UseDialogStateReturn<ComponentModel>,
    'openCreate' | 'openEdit'
  >
  instanceDialog: Pick<
    UseDialogStateReturn<Component>,
    'openCreate' | 'openEdit'
  >
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
  handleOpenSubtype: (subtype: ComponentSubtype) => void

  // Model handlers
  handleCreateModel: () => void
  handleEditModel: (model: ComponentModel) => void
  handleDeleteModel: (model: ComponentModel) => Promise<void>
  handleCreateInstance: (model: ComponentModel) => void
  handleOpenModelComponents: (model: ComponentModel) => void

  // Instance handlers
  handleCreateInstanceFromTable: () => void
  handleEditInstance: (instance: Component) => void
  handleDeleteInstance: (instance: Component) => Promise<void>
  handleViewHistory: (instance: Component) => void
}

export const useComponentLibraryHandlers = (
  params: UseComponentLibraryHandlersParams
): ComponentLibraryHandlers => {
  const {
    viewState,
    navigateTo,
    modelOptions,
    instanceDetailsDialog,
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
    if (viewState.level === 'categories') return

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
        alert(
          'Det gick inte att ta bort undertypen, den kan ha kopplade modeller.'
        )
      }
    }
  }

  const handleOpenSubtype = (subtype: ComponentSubtype) => {
    if (viewState.level !== 'subtypes') return

    navigateTo({
      level: 'subtype',
      subtypeId: subtype.id,
      subtypeName: subtype.subTypeName,
      typeId: viewState.typeId,
      typeName: viewState.typeName,
      categoryId: viewState.categoryId,
      categoryName: viewState.categoryName,
      tab: 'components',
    })
  }

  // Model handlers
  const handleCreateModel = () => modelDialog.openCreate()
  const handleEditModel = (model: ComponentModel) => modelDialog.openEdit(model)

  const handleDeleteModel = async (model: ComponentModel) => {
    if (viewState.level !== 'subtype') return

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
          'Det gick inte att ta bort modellen. Den kan ha kopplade komponenter.'
        )
      }
    }
  }

  const handleCreateInstance = (model: ComponentModel) =>
    instanceDialog.openCreate(instanceCreateDefaults(model))

  const handleOpenModelComponents = (model: ComponentModel) => {
    if (viewState.level !== 'subtype') return
    navigateTo({ ...viewState, tab: 'components', modelId: model.id })
  }

  // Instance handlers
  const handleCreateInstanceFromTable = () => {
    if (viewState.level !== 'subtype') return
    const model = modelOptions.find((m) => m.id === viewState.modelId)
    instanceDialog.openCreate(instanceCreateDefaults(model))
  }

  const handleEditInstance = (instance: Component) =>
    instanceDialog.openEdit(instance)

  const handleDeleteInstance = async (instance: Component) => {
    if (viewState.level !== 'subtype') return

    if (
      window.confirm(
        `Är du säker på att du vill ta bort komponenten "${formatComponentLabel(instance)}"?`
      )
    ) {
      try {
        await deleteInstance.mutateAsync({
          id: instance.id,
          parentId: viewState.subtypeId,
        })
      } catch (error) {
        console.error('Error deleting instance:', error)
        alert('Det gick inte att ta bort komponenten.')
      }
    }
  }

  const handleViewHistory = (instance: Component) => {
    instanceDetailsDialog.open(instance)
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
    handleOpenSubtype,

    // Model handlers
    handleCreateModel,
    handleEditModel,
    handleDeleteModel,
    handleCreateInstance,
    handleOpenModelComponents,

    // Instance handlers
    handleCreateInstanceFromTable,
    handleEditInstance,
    handleDeleteInstance,
    handleViewHistory,
  }
}
