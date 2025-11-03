import * as React from 'react'
import { Check, Edit, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './button'
import { Textarea } from './textarea'

export interface InlineTextareaEditorProps {
  value: string
  onSave: (value: string) => Promise<void>
  placeholder?: string
  emptyText?: string
  rows?: number
  className?: string
  textareaClassName?: string
  viewClassName?: string
  saveButtonText?: string
  cancelButtonText?: string
  showEditIcon?: boolean
  disabled?: boolean
}

export function InlineTextareaEditor({
  value,
  onSave,
  placeholder = 'Lägg till text...',
  emptyText = 'Klicka för att lägga till text',
  rows = 4,
  className,
  textareaClassName,
  viewClassName,
  saveButtonText = 'Spara',
  cancelButtonText = 'Avbryt',
  showEditIcon = true,
  disabled = false,
}: InlineTextareaEditorProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editedValue, setEditedValue] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)

  const handleEdit = () => {
    if (disabled) return
    setEditedValue(value)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedValue('')
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(editedValue)
      setIsEditing(false)
    } catch (error) {
      // Error handling is delegated to the onSave callback
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div className={cn('space-y-2', className)}>
        <Textarea
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={cn('resize-none text-sm', textareaClassName)}
          autoFocus
          disabled={isSaving}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Check className="h-4 w-4 mr-1" />
            {saveButtonText}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-1" />
            {cancelButtonText}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'cursor-pointer transition-colors group',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onClick={handleEdit}
    >
      {value ? (
        <div className="flex items-center gap-2">
          <p className={cn('flex-1 text-sm whitespace-pre-wrap', viewClassName)}>
            {value}
          </p>
          {showEditIcon && (
            <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className={cn('flex-1 text-sm text-muted-foreground italic', viewClassName)}>
            {emptyText}
          </p>
          {showEditIcon && (
            <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      )}
    </div>
  )
}
