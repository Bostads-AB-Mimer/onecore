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
import { toast } from '@/shared/hooks/useToast'

import { getComponentLocation } from '../lib/componentRows'
import { instanceCreateDefaults } from '../lib/instanceForm'
import type { ViewState } from '../lib/libraryUrlState'
import { serverMessage } from '../lib/serverMessage'
import type { Confirm, ConfirmOptions } from './useConfirmDialog'

export type { ViewState } from '../lib/libraryUrlState'

// Parameters interface - uses types from useDialogState
interface UseComponentLibraryHandlersParams {
  viewState: ViewState
  navigateTo: (state: ViewState) => void
  modelOptions: ComponentModel[]
  confirm: Confirm
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
  handleDeleteCategory: (category: ComponentCategory) => Promise<boolean>
  handleNavigateToTypes: (category: ComponentCategory) => void

  // Type handlers
  handleCreateType: () => void
  handleEditType: (type: ComponentType) => void
  handleDeleteType: (type: ComponentType) => Promise<boolean>
  handleNavigateToSubtypes: (type: ComponentType) => void

  // Subtype handlers
  handleCreateSubtype: () => void
  handleEditSubtype: (subtype: ComponentSubtype) => void
  handleDeleteSubtype: (subtype: ComponentSubtype) => Promise<boolean>
  handleOpenSubtype: (subtype: ComponentSubtype) => void

  // Model handlers
  handleCreateModel: () => void
  handleEditModel: (model: ComponentModel) => void
  handleDeleteModel: (model: ComponentModel) => Promise<boolean>
  handleCreateInstance: (model: ComponentModel) => void
  handleOpenModelComponents: (model: ComponentModel) => void

  // Instance handlers
  handleCreateInstanceFromTable: () => void
  handleEditInstance: (instance: Component) => void
  handleDeleteInstance: (instance: Component) => Promise<boolean>
  handleViewHistory: (instance: Component) => void
}

export const useComponentLibraryHandlers = (
  params: UseComponentLibraryHandlersParams
): ComponentLibraryHandlers => {
  const {
    viewState,
    navigateTo,
    modelOptions,
    confirm,
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

  const runDelete = async ({
    run,
    done,
    failed,
    ...options
  }: ConfirmOptions & {
    run: () => Promise<unknown>
    done: string
    failed: string
  }): Promise<boolean> => {
    if (!(await confirm(options))) return false
    try {
      await run()
      toast({ title: done })
      return true
    } catch (error) {
      toast({
        title: 'Kunde inte ta bort',
        description: serverMessage(error) ?? failed,
        variant: 'destructive',
      })
      return false
    }
  }

  // Category handlers
  const handleCreateCategory = () => categoryDialog.openCreate()
  const handleEditCategory = (category: ComponentCategory) =>
    categoryDialog.openEdit(category)

  const handleDeleteCategory = (category: ComponentCategory) =>
    runDelete({
      title: `Ta bort kategorin ${category.categoryName}?`,
      description:
        'Kategorin tas bort permanent. Det går bara om den saknar typer.',
      confirmLabel: 'Ta bort kategori',
      run: () => deleteCategory.mutateAsync({ id: category.id }),
      done: `Kategorin ${category.categoryName} togs bort`,
      failed:
        'Kategorin kan ha typer. Ta bort eller flytta dem och försök igen.',
    })

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
    if (viewState.level === 'categories') return false
    const parentId = viewState.categoryId

    return runDelete({
      title: `Ta bort typen ${type.typeName}?`,
      description:
        'Typen tas bort permanent. Det går bara om den saknar undertyper.',
      confirmLabel: 'Ta bort typ',
      run: () => deleteType.mutateAsync({ id: type.id, parentId }),
      done: `Typen ${type.typeName} togs bort`,
      failed:
        'Typen kan ha undertyper. Ta bort eller flytta dem och försök igen.',
    })
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
    if (viewState.level !== 'subtypes' && viewState.level !== 'subtype') {
      return false
    }
    const parentId = viewState.typeId

    return runDelete({
      title: `Ta bort undertypen ${subtype.subTypeName}?`,
      description:
        'Undertypen tas bort permanent. Det går bara om den saknar modeller och komponenter.',
      confirmLabel: 'Ta bort undertyp',
      run: () => deleteSubtype.mutateAsync({ id: subtype.id, parentId }),
      done: `Undertypen ${subtype.subTypeName} togs bort`,
      failed:
        'Undertypen kan ha modeller eller komponenter. Ta bort eller flytta dem och försök igen.',
    })
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
    if (viewState.level !== 'subtype') return false
    const parentId = viewState.subtypeId

    return runDelete({
      title: `Ta bort modellen ${model.modelName}?`,
      description:
        'Modellen tas bort permanent. Det går bara om inga komponenter använder den.',
      confirmLabel: 'Ta bort modell',
      run: () => deleteModel.mutateAsync({ id: model.id, parentId }),
      done: `Modellen ${model.modelName} togs bort`,
      failed:
        'Komponenter kan använda modellen. Byt modell på dem och försök igen.',
    })
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
    if (viewState.level !== 'subtype') return false
    const parentId = viewState.subtypeId
    const { address, detail } = getComponentLocation(instance)
    const place = address ? `${address}, ${detail}` : detail

    return runDelete({
      title: 'Ta bort komponenten?',
      description: `${formatComponentLabel(instance)} på ${place} tas bort ur registret. Det går inte att ångra.`,
      confirmLabel: 'Ta bort komponent',
      run: () => deleteInstance.mutateAsync({ id: instance.id, parentId }),
      done: 'Komponenten togs bort',
      failed:
        'En installerad komponent kan inte tas bort. Avinstallera den och försök igen.',
    })
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
