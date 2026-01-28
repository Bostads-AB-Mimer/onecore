import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/v2/Dialog'
import { Button } from '@/components/ui/v2/Button'
import { entityDialogConfig } from '../entity-dialog-config'
import { FieldRenderer } from './FieldRenderer'
import {
  ParentHierarchySelector,
  parentIdFieldMap,
  type HierarchyData,
} from './ParentHierarchySelector'
import { useComponentEntityMutation } from '@/components/hooks/useComponentEntityMutation'
import { useComponentEntity } from '@/components/hooks/useComponentEntity'
import type { EntityType } from '@/services/types'

// Mapping from entity type to the name field used for duplicate checking
const entityNameFieldMap: Partial<Record<EntityType, string>> = {
  category: 'categoryName',
  type: 'typeName',
  subtype: 'subTypeName',
  model: 'modelName',
}

// Swedish labels for error messages
const entityLabels: Partial<Record<EntityType, string>> = {
  category: 'kategori',
  type: 'typ',
  subtype: 'undertyp',
  model: 'modell',
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
  const [submitError, setSubmitError] = useState<string | null>(null)

  const mutation = useComponentEntityMutation(
    entityType,
    mode === 'create' ? 'create' : 'update',
    entity?.id
  )

  // Fetch existing entities for duplicate checking (skip for instances)
  const shouldCheckDuplicates = entityType !== 'instance'
  const { data: existingEntities = [] } = useComponentEntity(
    entityType,
    parentId,
    undefined,
    { enabled: shouldCheckDuplicates && isOpen }
  )

  // Fetch entities from the NEW parent when moving (for duplicate checking in target)
  const { data: targetParentEntities = [] } = useComponentEntity(
    entityType,
    newParentId,
    undefined,
    { enabled: shouldCheckDuplicates && isOpen && !!newParentId }
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
      setSubmitError(null) // Clear any previous submit errors
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
    // Clear submit error when user makes changes
    if (submitError) {
      setSubmitError(null)
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

    // Check for duplicate name (skip for instances)
    // In edit mode, only check if the name has actually changed
    if (entityType !== 'instance') {
      const nameField = entityNameFieldMap[entityType]
      if (nameField) {
        const nameValue = formData[nameField]?.toString().trim().toLowerCase()
        const originalName = entity?.[nameField]
          ?.toString()
          .trim()
          .toLowerCase()

        // Only check for duplicates if:
        // 1. Creating a new entity, OR
        // 2. Editing and the name has changed
        const nameHasChanged = mode === 'create' || nameValue !== originalName

        if (nameValue && nameHasChanged) {
          const isDuplicate = existingEntities.some((existing: any) => {
            // Skip current entity in edit mode
            if (mode === 'edit' && existing.id === entity?.id) return false

            const existingName = existing[nameField]
              ?.toString()
              .trim()
              .toLowerCase()
            return existingName === nameValue
          })

          if (isDuplicate) {
            const label = entityLabels[entityType] || entityType
            newErrors[nameField] = `Det finns redan en ${label} med detta namn`
          }
        }

        // When moving to a new parent, check for duplicates in the TARGET parent
        if (nameValue && newParentId) {
          const isDuplicateInTarget = targetParentEntities.some(
            (existing: any) => {
              const existingName = existing[nameField]
                ?.toString()
                .trim()
                .toLowerCase()
              return existingName === nameValue
            }
          )

          if (isDuplicateInTarget) {
            const label = entityLabels[entityType] || entityType
            newErrors[nameField] =
              `Det finns redan en ${label} med detta namn i den valda kategorin`
          }
        }
      }
    }

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
    setSubmitError(null) // Clear previous submit error

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
    } catch (error: any) {
      console.error(
        `Error ${mode === 'create' ? 'creating' : 'updating'} ${entityType}:`,
        error
      )

      // Extract error message from the API response
      let errorMessage = 'Ett oväntat fel uppstod. Försök igen.'

      if (error?.error) {
        // Backend error format: { error: "message" }
        errorMessage = translateBackendError(error.error)
      } else if (error?.message) {
        errorMessage = error.message
      }

      setSubmitError(errorMessage)
    }
  }

  // Translate common backend error messages to Swedish
  const translateBackendError = (error: string): string => {
    const translations: Record<string, string> = {
      'Invalid categoryId: category does not exist':
        'Den valda kategorin finns inte längre. Vänligen uppdatera sidan och försök igen.',
      'Invalid typeId: type does not exist':
        'Den valda typen finns inte längre. Vänligen uppdatera sidan och försök igen.',
      'Invalid componentSubtypeId: subtype does not exist':
        'Den valda undertypen finns inte längre. Vänligen uppdatera sidan och försök igen.',
      'Invalid modelId: model does not exist':
        'Den valda modellen finns inte längre. Vänligen uppdatera sidan och försök igen.',
      'Component type not found':
        'Typen kunde inte hittas. Den kan ha tagits bort.',
      'Component subtype not found':
        'Undertypen kunde inte hittas. Den kan ha tagits bort.',
      'Component model not found':
        'Modellen kunde inte hittas. Den kan ha tagits bort.',
      'Component category not found':
        'Kategorin kunde inte hittas. Den kan ha tagits bort.',
      'Invalid UUID format':
        'Ogiltigt ID-format. Vänligen uppdatera sidan och försök igen.',
    }

    return translations[error] || error
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
              onParentChange={(id) => {
                setNewParentId(id)
                setSubmitError(null) // Clear error when parent changes
              }}
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

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
