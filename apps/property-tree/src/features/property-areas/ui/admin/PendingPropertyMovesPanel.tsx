import { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, Undo2 } from 'lucide-react'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/Collapsible'

import { PropertyMoveChange } from '../../types/adminTypes'

interface PendingPropertyMovesPanelProps {
  changes: PropertyMoveChange[]
  onUndo: (propertyCode: string) => void
  onCancelAll: () => void
  onSave: () => void
  isSaving?: boolean
}

export function PendingPropertyMovesPanel({
  changes,
  onUndo,
  onCancelAll,
  onSave,
  isSaving = false,
}: PendingPropertyMovesPanelProps) {
  const [isOpen, setIsOpen] = useState(true)

  if (changes.length === 0) return null

  return (
    <Card className="border-warning bg-warning/10">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between w-full">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-left">
                <CardTitle className="text-base">
                  Väntande flyttar av fastigheter
                </CardTitle>
                <Badge variant="secondary">{changes.length}</Badge>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelAll}
                disabled={isSaving}
              >
                Avbryt alla
              </Button>
              <Button size="sm" onClick={onSave} disabled={isSaving}>
                {isSaving ? 'Sparar…' : 'Spara'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <div className="space-y-2">
              {changes.map((change) => (
                <div
                  key={change.propertyCode}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-background/80"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium text-sm truncate">
                      {change.propertyName}
                    </span>
                    <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
                      <span className="truncate max-w-[120px]">
                        {change.fromKvvArea}
                      </span>
                      <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate max-w-[120px] text-foreground">
                        {change.toKvvArea}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUndo(change.propertyCode)}
                    disabled={isSaving}
                    className="flex-shrink-0"
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Ångra
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
