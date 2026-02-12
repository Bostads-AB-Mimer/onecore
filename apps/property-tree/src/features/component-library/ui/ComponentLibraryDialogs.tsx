import { GenericEntityDialog } from '../dialogs/GenericEntityDialog'
import { InstanceDetailsDialog } from '../dialogs/InstanceDetailsDialog'
import { DeinstallationDialog } from './DeinstallationDialog'
import type { ViewState } from '../hooks/useComponentLibraryHandlers'
import type {
  UseDialogStateReturn,
  UseSimpleDialogStateReturn,
} from '../../../shared/hooks/useDialogState'
import type {
  ComponentCategory,
  ComponentType,
  ComponentSubtype,
  ComponentModel,
  Component,
} from '@/services/types'

interface ComponentLibraryDialogsProps {
  viewState: ViewState
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
  categoryDialog,
  typeDialog,
  subtypeDialog,
  modelDialog,
  instanceDialog,
  instanceDetailsDialog,
  deinstallDialog,
}: ComponentLibraryDialogsProps) => {
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

      {/* Type Dialog - available at types, subtypes, models levels */}
      {(viewState.level === 'types' ||
        viewState.level === 'subtypes' ||
        viewState.level === 'models') && (
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

      {/* Subtype Dialog - available at subtypes, models levels */}
      {(viewState.level === 'subtypes' || viewState.level === 'models') && (
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

      {/* Model Dialog - available at models level */}
      {viewState.level === 'models' && (
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

      {/* Instance-related Dialogs - available at instances level */}
      {viewState.level === 'instances' && (
        <>
          <GenericEntityDialog
            isOpen={instanceDialog.state.isOpen}
            onClose={instanceDialog.close}
            entityType="instance"
            entity={instanceDialog.state.entity}
            defaultValues={instanceDialog.state.defaultValues}
            parentId={viewState.modelId}
            mode={instanceDialog.state.mode}
            hierarchyData={{
              categoryId: viewState.categoryId,
              typeId: viewState.typeId,
              subtypeId: viewState.subtypeId,
              modelId: viewState.modelId,
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
                deinstallDialog.state.data.componentInstallations?.find(
                  (inst) => !inst.deinstallationDate
                )?.spaceId || ''
              }
            />
          )}
        </>
      )}
    </>
  )
}
