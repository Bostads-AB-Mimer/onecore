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
import { useComponentEntityMutation } from '@/components/hooks/useComponentEntityMutation'
import type { EntityType } from '@/components/hooks/useComponentEntity.types'

interface GenericEntityDialogProps<T extends Record<string, any>> {
  isOpen: boolean
  onClose: () => void
  entityType: EntityType
  entity?: T
  parentId?: string
  mode: 'create' | 'edit'
}

export function GenericEntityDialog<T extends Record<string, any>>({
  isOpen,
  onClose,
  entityType,
  entity,
  parentId,
  mode,
}: GenericEntityDialogProps<T>) {
  const config = entityDialogConfig[entityType]
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

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
            editData[field.name] = entity[field.name]
          }
        })
        setFormData(editData)
      }
      setErrors({})
    }
  }, [isOpen, mode, entity, parentId, entityType, config.fields])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      // For mutations, we need to pass parentId separately for cache invalidation
      const mutationData = mode === 'create'
        ? { ...formData, parentId }
        : { id: entity?.id, data: formData, parentId }

      await mutation.mutateAsync(mutationData as any)
      onClose()
    } catch (error) {
      console.error(`Error ${mode === 'create' ? 'creating' : 'updating'} ${entityType}:`, error)
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
