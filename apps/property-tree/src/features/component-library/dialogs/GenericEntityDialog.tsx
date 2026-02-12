import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { entityDialogConfig } from '../constants/entityDialogConfig'
import { FieldRenderer } from './FieldRenderer'
import {
  ParentHierarchySelector,
  parentIdFieldMap,
  type HierarchyData,
} from './ParentHierarchySelector'
import { useComponentEntityMutation } from '@/entities/component'
import type { EntityType } from '@/services/types'

interface GenericEntityDialogProps<T extends Record<string, any>> {
  isOpen: boolean
  onClose: () => void
  entityType: EntityType
  entity?: T
  parentId?: string
  mode: 'create' | 'edit'
  defaultValues?: Record<string, any>
  hierarchyData?: HierarchyData
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
}: GenericEntityDialogProps<T>) {
  const config = entityDialogConfig[entityType]
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newParentId, setNewParentId] = useState<string | undefined>(undefined)

  const mutation = useComponentEntityMutation(
    entityType,
    mode === 'create' ? 'create' : 'update',
    entity?.id
  )

  // Initialize form data
  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        // Set default values for create mode
        const defaults: Record<string, any> = {}
        config.fields.forEach((field) => {
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
              defaults.modelId = parentId
              break
          }
        }

        setFormData(defaults)
      } else if (entity) {
        // Set existing entity data for edit mode
        // Only include fields that are defined in the config to avoid sending
        // read-only fields like id, createdAt, updatedAt, etc.
        const editData: Record<string, any> = {}
        config.fields.forEach((field) => {
          if (entity[field.name] !== undefined) {
            let value = entity[field.name]
            // Convert ISO date strings to yyyy-MM-dd format
            if (
              field.type === 'date' &&
              value &&
              typeof value === 'string' &&
              value.includes('T')
            ) {
              value = value.split('T')[0]
            }
            editData[field.name] = value
          }
        })
        setFormData(editData)
      }
      setErrors({})
      setNewParentId(undefined) // Reset parent change when dialog opens
    }
  }, [isOpen, mode, entity, parentId, entityType, config.fields, defaultValues])

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

    config.fields.forEach((field) => {
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
  const cleanFormData = (data: Record<string, any>): Record<string, any> => {
    const cleaned: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      // Convert empty strings to undefined for optional fields
      if (value === '') {
        const field = config.fields.find((f) => f.name === key)
        if (field && !field.required) {
          // Skip empty optional fields (don't include in payload)
          continue
        }
      }
      cleaned[key] = value
    }
    return cleaned
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      // For mutations, we need to pass parentId separately for cache invalidation
      let mutationData
      if (mode === 'create') {
        mutationData = { ...cleanFormData(formData), parentId }
      } else {
        // Build update data, including new parent ID if changed
        const updateData = cleanFormData(formData)

        // If parent has changed, add the new parent ID field
        if (newParentId && entityType !== 'category') {
          const parentField = parentIdFieldMap[entityType]
          updateData[parentField] = newParentId
        }

        mutationData = {
          id: entity?.id,
          data: updateData,
          parentId: newParentId || parentId,
          oldParentId: newParentId ? parentId : undefined,
        }
      }

      await mutation.mutateAsync(mutationData as any)
      onClose()
    } catch (error) {
      console.error(
        `Error ${mode === 'create' ? 'creating' : 'updating'} ${entityType}:`,
        error
      )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? config.createTitle : config.editTitle}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Parent hierarchy selector for edit mode (non-category entities) */}
          {mode === 'edit' && entityType !== 'category' && hierarchyData && (
            <ParentHierarchySelector
              entityType={entityType}
              initialHierarchy={hierarchyData}
              onParentChange={setNewParentId}
            />
          )}

          {config.fields.map((field) => (
            <FieldRenderer
              key={field.name}
              field={field}
              value={formData[field.name]}
              onChange={handleChange}
              error={errors[field.name]}
            />
          ))}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
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
            <p className="text-sm text-destructive">
              Ett fel uppstod. Försök igen.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
