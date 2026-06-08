import { useEffect, useState } from 'react'
import { Camera, ChevronRight, MessageSquare, Wrench } from 'lucide-react'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Textarea'

import {
  type ComponentType,
  CONDITION_OPTIONS,
  CONDITION_TYPE,
  COST_RESPONSIBILITY,
  COST_RESPONSIBILITY_LABEL,
  type CostResponsibility,
  getActionsForComponentType,
  getConditionConfig,
} from '../constants'
import { PhotoCapture, type InspectionPhotoUploadContext } from './PhotoCapture'

interface ComponentInspectionCardProps {
  componentKey: string
  label: string
  condition: string
  note: string
  photoCount: number
  actions: string[]
  componentType: ComponentType
  costResponsibility: CostResponsibility
  onConditionChange: (value: string) => void
  onNoteChange: (value: string) => void
  onActionToggle: (action: string) => void
  onCostResponsibilityChange: (value: CostResponsibility) => void
  onPhotoCaptured: (path: string) => void
  uploadContext: InspectionPhotoUploadContext
  onOpenDetail: () => void
}

export function ComponentInspectionCard({
  componentKey,
  label,
  condition,
  note,
  photoCount,
  actions,
  componentType,
  costResponsibility,
  onConditionChange,
  onNoteChange,
  onActionToggle,
  onCostResponsibilityChange,
  onPhotoCaptured,
  uploadContext,
  onOpenDetail,
}: ComponentInspectionCardProps) {
  const actionOptions = getActionsForComponentType(componentType)
  const [isNoteFocused, setIsNoteFocused] = useState(false)
  // Start expanded when there's no grade yet or when the component is already
  // flagged as damaged. God/Ok cards start collapsed to reduce visual noise
  // for rooms with mostly intact components.
  const [isExpanded, setIsExpanded] = useState(
    condition === '' || condition === CONDITION_TYPE.DAMAGED
  )
  const hasLongNote = note.length > 50
  const conditionConfig = getConditionConfig(condition)

  // Auto-collapse on God/Ok and auto-expand on Skadad — only on actual
  // condition transitions (useEffect deps), so a manual toggle isn't
  // overridden by unrelated re-renders.
  useEffect(() => {
    if (
      condition === CONDITION_TYPE.GOOD ||
      condition === CONDITION_TYPE.ACCEPTABLE
    ) {
      setIsExpanded(false)
    } else if (condition === CONDITION_TYPE.DAMAGED) {
      setIsExpanded(true)
    }
  }, [condition])

  return (
    <div className="border-b border-border last:border-0 py-4">
      {/* Header — label area toggles expand/collapse; icon buttons are
          siblings (not nested) so they can keep their own click handlers
          without invalid nested <button> markup. */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <h4 className="text-base font-medium truncate">{label}</h4>
          {!isExpanded && conditionConfig && (
            <Badge
              variant={conditionConfig.badgeVariant}
              className={conditionConfig.badgeClassName}
            >
              {conditionConfig.label}
            </Badge>
          )}
        </button>
        <div className="flex items-center gap-2 shrink-0">
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

      {isExpanded && (
        <>
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

          {/* Action toggle row — only shown for Skadad. Sourced from
              ACTION_OPTIONS_BY_TYPE so each component category exposes the
              right subset (walls → Målning/Reparation/…, floor → Byte/Slipning/…). */}
          {condition === CONDITION_TYPE.DAMAGED && actionOptions.length > 0 && (
            <div className="mb-3">
              <p className="text-sm text-muted-foreground mb-2">Åtgärd</p>
              <div className="flex flex-wrap gap-2">
                {actionOptions.map((option) => {
                  const isSelected = actions.includes(option.value)
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className="h-9 text-sm font-medium"
                      onClick={() => onActionToggle(option.value)}
                    >
                      {option.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Cost responsibility radio — only shown for Skadad */}
          {condition === CONDITION_TYPE.DAMAGED && (
            <div className="mb-3">
              <p className="text-sm text-muted-foreground mb-2">
                Kostnadsansvar
              </p>
              <div className="flex gap-4">
                {[COST_RESPONSIBILITY.TENANT, COST_RESPONSIBILITY.LANDLORD].map(
                  (value) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`cost-${componentKey}`}
                        value={value}
                        checked={costResponsibility === value}
                        onChange={() => onCostResponsibilityChange(value)}
                      />
                      {COST_RESPONSIBILITY_LABEL[value]}
                    </label>
                  )
                )}
              </div>
            </div>
          )}

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
            <PhotoCapture
              onPhotoCaptured={onPhotoCaptured}
              uploadContext={uploadContext}
            />
          </div>
        </>
      )}
    </div>
  )
}
