import { Camera, MessageSquare, Wrench } from 'lucide-react'

import { Badge } from '@/shared/ui/Badge'
import { Separator } from '@/shared/ui/Separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/Sheet'
import { Textarea } from '@/shared/ui/Textarea'

import { type ComponentType, getConditionConfig } from '../constants'
import { ActionChecklist } from './ActionChecklist'
import type { InspectionPhotoUploadContext } from './PhotoCapture'
import { PhotoGallery } from './PhotoGallery'

interface ComponentDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  componentKey: string
  label: string
  condition: string
  note: string
  photos: string[]
  actions: string[]
  componentType: ComponentType
  onNoteChange: (note: string) => void
  onPhotoAdd: (path: string) => void
  onPhotoRemove: (index: number) => void
  onActionToggle: (action: string) => void
  uploadContext: InspectionPhotoUploadContext
}

export function ComponentDetailSheet({
  isOpen,
  onClose,
  label,
  condition,
  note,
  photos,
  actions,
  componentType,
  onNoteChange,
  onPhotoAdd,
  onPhotoRemove,
  onActionToggle,
  uploadContext,
}: ComponentDetailSheetProps) {
  const conditionConfig = getConditionConfig(condition)

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Condition Badge */}
          {condition && conditionConfig && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Skick</p>
              <Badge
                variant={conditionConfig.badgeVariant}
                className={conditionConfig.badgeClassName}
              >
                {conditionConfig.label}
              </Badge>
            </div>
          )}

          <Separator />

          {/* Photos Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Foton ({photos.length})</h3>
            </div>
            <PhotoGallery
              photos={photos}
              onRemovePhoto={onPhotoRemove}
              onAddPhoto={onPhotoAdd}
              uploadContext={uploadContext}
            />
          </div>

          <Separator />

          {/* Actions Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Åtgärder</h3>
            </div>
            <ActionChecklist
              componentType={componentType}
              selectedActions={actions}
              onActionToggle={onActionToggle}
            />
          </div>

          <Separator />

          {/* Notes Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Anteckningar</h3>
            </div>
            <Textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Skriv en anteckning..."
              className="min-h-[100px]"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
