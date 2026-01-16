import { useState } from 'react'
import { Button } from '@/components/ui/v2/Button'
import { Textarea } from '@/components/ui/Textarea'
import { ChevronRight, Camera, Wrench, MessageSquare } from 'lucide-react'
import { PhotoCapture } from '@/inspections/components/PhotoCapture'
import { CONDITION_OPTIONS } from '@/inspections/constants'

interface ComponentInspectionCardProps {
  componentKey: string
  label: string
  condition: string
  note: string
  photoCount: number
  actions: string[]
  onConditionChange: (value: string) => void
  onNoteChange: (value: string) => void
  onPhotoCapture: (photoDataUrl: string) => void
  onOpenDetail: () => void
}

export function ComponentInspectionCard({
  label,
  condition,
  note,
  photoCount,
  actions,
  onConditionChange,
  onNoteChange,
  onPhotoCapture,
  onOpenDetail,
}: ComponentInspectionCardProps) {
  const [isNoteFocused, setIsNoteFocused] = useState(false)
  const hasLongNote = note.length > 50

  return (
    <div className="border-b border-border last:border-0 py-4">
      {/* Header with indicators */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-medium">{label}</h4>
        <div className="flex items-center gap-2">
          {photoCount > 0 && (
            <button
              onClick={onOpenDetail}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
            >
              <Camera className="h-4 w-4" />
              <span>{photoCount}</span>
            </button>
          )}
          {actions.length > 0 && (
            <button
              onClick={onOpenDetail}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            >
              <Wrench className="h-4 w-4" />
            </button>
          )}
          {hasLongNote && (
            <button
              onClick={onOpenDetail}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onOpenDetail}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Condition buttons */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {CONDITION_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={condition === option.value ? 'default' : 'outline'}
            size="default"
            className={`h-10 text-sm font-medium ${condition === option.value ? option.buttonClassName : ''}`}
            onClick={() => onConditionChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Note field and photo button */}
      <div className="flex gap-2 items-start">
        <Textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          onFocus={() => setIsNoteFocused(true)}
          onBlur={() => setIsNoteFocused(false)}
          placeholder="Anteckning..."
          className={`flex-1 text-sm resize-none transition-all ${
            isNoteFocused ? 'min-h-[80px]' : 'min-h-[40px] h-[40px]'
          }`}
        />
        <PhotoCapture onPhotoCapture={onPhotoCapture} photoCount={0} />
      </div>
    </div>
  )
}
