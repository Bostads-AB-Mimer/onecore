import { useEffect, useMemo, useRef, useState } from 'react'

import {
  useComponentEntity,
  useComponentEntityMutation,
} from '@/entities/component'

import type { ComponentModel, EntityType } from '@/services/types'

import { toast } from '@/shared/hooks/useToast'
import { formatComponentModelName } from '@/shared/lib/componentLabels'
import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'

import {
  entityDialogConfig,
  type FieldConfig,
} from '../constants/entityDialogConfig'
import { useConfirmDialog } from '../hooks/useConfirmDialog'
import { cleanFormData } from '../lib/cleanFormData'
import type { CategoryType } from '../lib/componentRows'
import { buildEditFormData } from '../lib/editFormData'
import { isFormDirty } from '../lib/formDirty'
import {
  applyInstanceMove,
  buildInstanceFields,
  instanceMoveFormData,
} from '../lib/instanceForm'
import { serverMessage } from '../lib/serverMessage'
import { FieldRenderer } from './FieldRenderer'
import {
  type HierarchyData,
  ParentHierarchySelector,
  parentIdFieldMap,
} from './ParentHierarchySelector'

const NO_MODELS: ComponentModel[] = []

const ENTITY_NOUNS: Record<EntityType, string> = {
  category: 'Kategorin',
  type: 'Typen',
  subtype: 'Undertypen',
  model: 'Modellen',
  instance: 'Komponenten',
}

interface GenericEntityDialogProps<T extends Record<string, any>> {
  isOpen: boolean
  onClose: () => void
  entityType: EntityType
  entity?: T
  parentId?: string
  mode: 'create' | 'edit'
  defaultValues?: Record<string, any>
  hierarchyData?: HierarchyData
  fields?: FieldConfig[]
  /** Names the edited entity under the title, e.g. a component and its place. */
  description?: string
}

export function GenericEntityDialog<T extends Record<string, any>>({
  isOpen,
  onClose,
  entityType,
  entity,
  parentId,
  mode,
  defaultValues,
  hierarchyData,
  fields: fieldsOverride,
  description,
}: GenericEntityDialogProps<T>) {
  const config = entityDialogConfig[entityType]
  const fields = fieldsOverride ?? config.fields
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newParentId, setNewParentId] = useState<string | undefined>(undefined)
  const [targetCategoryType, setTargetCategoryType] = useState<
    CategoryType | undefined
  >(undefined)
  const initialDataRef = useRef<Record<string, any>>({})
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  const isInstanceMove =
    entityType === 'instance' &&
    !!newParentId &&
    newParentId !== hierarchyData?.subtypeId

  const targetModels = useComponentEntity(
    'model',
    isInstanceMove ? newParentId : undefined,
    undefined,
    { enabled: isInstanceMove && targetCategoryType !== 'SURFACE' }
  )

  // A moved component gets the target subtype's model list, or none for a surface.
  const shownFields = useMemo(
    () =>
      isInstanceMove
        ? buildInstanceFields(
            targetCategoryType ?? 'EQUIPMENT',
            targetModels.data ?? NO_MODELS
          )
        : fields,
    [isInstanceMove, targetCategoryType, targetModels.data, fields]
  )

  const mutation = useComponentEntityMutation(
    entityType,
    mode === 'create' ? 'create' : 'update'
  )

  // Initialize once per opening: `fields` changes while open as the model list loads.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current
    wasOpenRef.current = isOpen
    if (justOpened) {
      if (mode === 'create') {
        // Set default values for create mode
        const defaults: Record<string, any> = {}
        fields.forEach((field) => {
          if (field.defaultValue !== undefined) {
            defaults[field.name] = field.defaultValue
          }
        })

        // Merge in any passed defaultValues (from parent entity)
        if (defaultValues) {
          Object.assign(defaults, defaultValues)
        }

        // Add parent ID based on entity type
        if (parentId) {
          switch (entityType) {
            case 'type':
              defaults.categoryId = parentId
              break
            case 'subtype':
              defaults.typeId = parentId
              break
            case 'model':
              defaults.componentSubtypeId = parentId
              break
            case 'instance':
              defaults.subtypeId = parentId
              break
          }
        }

        setFormData(defaults)
        initialDataRef.current = defaults
      } else if (entity) {
        // Only fields in the config, so read-only ones like id and createdAt stay out
        const editData = buildEditFormData(fields, entity)
        setFormData(editData)
        initialDataRef.current = editData
      }
      setErrors({})
      setNewParentId(undefined) // Reset parent change when dialog opens
      setTargetCategoryType(undefined)
    }
  }, [isOpen, mode, entity, parentId, entityType, fields, defaultValues])

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    shownFields.forEach((field) => {
      if (field.required) {
        const value = formData[field.name]
        if (value === undefined || value === null || value === '') {
          newErrors[field.name] = `${field.label} är obligatoriskt`
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Clean form data by converting empty strings to undefined for optional fields
  // This prevents validation errors for fields with regex patterns (e.g., ncsCode)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      // For mutations, we need to pass parentId separately for cache invalidation
      let mutationData
      if (mode === 'create') {
        mutationData = { ...cleanFormData(shownFields, formData), parentId }
      } else {
        // Build update data, including new parent ID if changed
        const updateData = cleanFormData(shownFields, formData)

        if (entityType === 'instance') {
          Object.assign(
            updateData,
            applyInstanceMove(hierarchyData?.subtypeId, newParentId)
          )
        } else if (newParentId && entityType !== 'category') {
          updateData[parentIdFieldMap[entityType]] = newParentId
        }

        mutationData = {
          id: entity?.id,
          data: updateData,
          parentId: newParentId || parentId,
          oldParentId: newParentId ? parentId : undefined,
        }
      }

      await mutation.mutateAsync(mutationData as any)
      toast({
        title:
          mode === 'create'
            ? `${ENTITY_NOUNS[entityType]} skapades`
            : 'Ändringarna sparades',
      })
      onClose()
    } catch {
      // The form shows mutation.error inline.
    }
  }

  const handleParentChange = (
    parentId: string | undefined,
    categoryType: CategoryType | undefined
  ) => {
    const parentChanged = parentId !== newParentId
    setNewParentId(parentId)
    setTargetCategoryType(categoryType)
    if (entityType !== 'instance' || !parentChanged) return
    const moved = !!parentId && parentId !== hierarchyData?.subtypeId
    setFormData((prev) =>
      instanceMoveFormData(prev, initialDataRef.current, moved, categoryType)
    )
  }

  const initialParentId =
    entityType === 'instance' || entityType === 'model'
      ? hierarchyData?.subtypeId
      : entityType === 'subtype'
        ? hierarchyData?.typeId
        : hierarchyData?.categoryId

  const requestClose = async () => {
    const changed =
      isFormDirty(initialDataRef.current, formData) ||
      (!!newParentId && newParentId !== initialParentId)
    if (
      changed &&
      !(await confirm({
        title: 'Osparade ändringar',
        description: 'Om du stänger nu försvinner det du har fyllt i.',
        confirmLabel: 'Släng ändringar',
        cancelLabel: 'Fortsätt redigera',
      }))
    ) {
      return
    }
    onClose()
  }

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open: boolean) => {
          if (!open) void requestClose()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? config.createTitle : config.editTitle}
            </DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Parent hierarchy selector for edit mode (non-category entities) */}
            {mode === 'edit' && entityType !== 'category' && hierarchyData && (
              <ParentHierarchySelector
                entityType={entityType}
                initialHierarchy={hierarchyData}
                currentModelName={
                  entityType === 'instance'
                    ? formatComponentModelName(entity?.model) || undefined
                    : undefined
                }
                onParentChange={(parentId, _subtypeId, categoryType) =>
                  handleParentChange(parentId, categoryType)
                }
              />
            )}

            {shownFields.map((field) => (
              <FieldRenderer
                key={field.name}
                field={field}
                value={formData[field.name]}
                onChange={handleChange}
                error={errors[field.name]}
              />
            ))}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Avbryt
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? mode === 'create'
                    ? 'Skapar...'
                    : 'Sparar...'
                  : mode === 'create'
                    ? 'Skapa'
                    : 'Spara'}
              </Button>
            </DialogFooter>

            {mutation.isError && (
              <p className="text-sm text-destructive" role="alert">
                {serverMessage(mutation.error) ??
                  'Det gick inte att spara. Försök igen.'}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  )
}
