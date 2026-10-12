import { useMemo } from 'react'

import { formatComponentLabel } from '@/entities/component'

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

import { GenericEntityDialog } from '../dialogs/GenericEntityDialog'
import { InstanceDetailsDialog } from '../dialogs/InstanceDetailsDialog'
import type { ViewState } from '../hooks/useComponentLibraryHandlers'
import {
  activeInstallation,
  type CategoryType,
  getComponentLocation,
} from '../lib/componentRows'
import { buildInstanceFields } from '../lib/instanceForm'
import { DeinstallationDialog } from './DeinstallationDialog'

const describeComponent = (component: Component) => {
  const { address, detail } = getComponentLocation(component)
  const place = address ? `${address}, ${detail}` : detail
  return `${formatComponentLabel(component)} · ${place}`
}

interface ComponentLibraryDialogsProps {
  viewState: ViewState
  categoryType: CategoryType | undefined
  modelOptions: ComponentModel[]
  categoryDialog: UseDialogStateReturn<ComponentCategory>
  typeDialog: UseDialogStateReturn<ComponentType>
  subtypeDialog: UseDialogStateReturn<ComponentSubtype>
  modelDialog: UseDialogStateReturn<ComponentModel>
  instanceDialog: UseDialogStateReturn<Component>
  instanceDetailsDialog: UseSimpleDialogStateReturn<Component>
  deinstallDialog: UseSimpleDialogStateReturn<Component>
}

export const ComponentLibraryDialogs = ({
  viewState,
  categoryType,
  modelOptions,
  categoryDialog,
  typeDialog,
  subtypeDialog,
  modelDialog,
  instanceDialog,
  instanceDetailsDialog,
  deinstallDialog,
}: ComponentLibraryDialogsProps) => {
  const instanceFields = useMemo(
    () =>
      categoryType
        ? buildInstanceFields(categoryType, modelOptions)
        : undefined,
    [categoryType, modelOptions]
  )

  return (
    <>
      {/* Category Dialog - always available */}
      <GenericEntityDialog
        isOpen={categoryDialog.state.isOpen}
        onClose={categoryDialog.close}
        entityType="category"
        entity={categoryDialog.state.entity}
        mode={categoryDialog.state.mode}
      />

      {/* Type Dialog - available at types, subtypes, subtype levels */}
      {(viewState.level === 'types' ||
        viewState.level === 'subtypes' ||
        viewState.level === 'subtype') && (
        <GenericEntityDialog
          isOpen={typeDialog.state.isOpen}
          onClose={typeDialog.close}
          entityType="type"
          entity={typeDialog.state.entity}
          parentId={viewState.categoryId}
          mode={typeDialog.state.mode}
          hierarchyData={{
            categoryId: viewState.categoryId,
          }}
        />
      )}

      {/* Subtype Dialog - available at subtypes, subtype levels */}
      {(viewState.level === 'subtypes' || viewState.level === 'subtype') && (
        <GenericEntityDialog
          isOpen={subtypeDialog.state.isOpen}
          onClose={subtypeDialog.close}
          entityType="subtype"
          entity={subtypeDialog.state.entity}
          parentId={viewState.typeId}
          mode={subtypeDialog.state.mode}
          hierarchyData={{
            categoryId: viewState.categoryId,
            typeId: viewState.typeId,
          }}
        />
      )}

      {/* Model Dialog - available at subtype level */}
      {viewState.level === 'subtype' && (
        <GenericEntityDialog
          isOpen={modelDialog.state.isOpen}
          onClose={modelDialog.close}
          entityType="model"
          entity={modelDialog.state.entity}
          parentId={viewState.subtypeId}
          mode={modelDialog.state.mode}
          hierarchyData={{
            categoryId: viewState.categoryId,
            typeId: viewState.typeId,
            subtypeId: viewState.subtypeId,
          }}
        />
      )}

      {/* Instance-related Dialogs - available at subtype level */}
      {viewState.level === 'subtype' && instanceFields && (
        <>
          <GenericEntityDialog
            isOpen={instanceDialog.state.isOpen}
            onClose={instanceDialog.close}
            entityType="instance"
            entity={instanceDialog.state.entity}
            defaultValues={instanceDialog.state.defaultValues}
            parentId={viewState.subtypeId}
            mode={instanceDialog.state.mode}
            fields={instanceFields}
            description={
              instanceDialog.state.entity
                ? describeComponent(instanceDialog.state.entity)
                : undefined
            }
            hierarchyData={{
              categoryId: viewState.categoryId,
              typeId: viewState.typeId,
              subtypeId: viewState.subtypeId,
            }}
          />

          {instanceDetailsDialog.state.data && (
            <InstanceDetailsDialog
              isOpen={instanceDetailsDialog.state.isOpen}
              onClose={instanceDetailsDialog.close}
              instance={instanceDetailsDialog.state.data}
            />
          )}

          {deinstallDialog.state.data && (
            <DeinstallationDialog
              isOpen={deinstallDialog.state.isOpen}
              onClose={deinstallDialog.close}
              component={deinstallDialog.state.data}
              spaceId={
                activeInstallation(deinstallDialog.state.data)?.spaceId || ''
              }
            />
          )}
        </>
      )}
    </>
  )
}
