import React, { useState } from 'react'
import { ArrowRight, ChevronDown, ChevronUp, Undo2 } from 'lucide-react'

import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/Collapsible'

import { AreaReassignment } from '../../types/adminTypes'

interface PendingChangesPanelProps {
  changes: AreaReassignment[]
  onUndo: (kvvArea: string) => void
}

export function PendingChangesPanel({
  changes,
  onUndo,
}: PendingChangesPanelProps) {
  const [isOpen, setIsOpen] = useState(true)

  if (changes.length === 0) return null

  return (
    <Card className="border-warning bg-warning/10">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Väntande ändringar</CardTitle>
                <Badge variant="secondary">{changes.length}</Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            <div className="space-y-2">
              {changes.map((change) => (
                <div
                  key={change.kvvArea}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-background/80"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium text-sm">
                      Område {change.kvvArea}
                    </span>
                    <span className="text-muted-foreground text-sm hidden sm:inline">
                      :
                    </span>
                    <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
                      <span className="truncate max-w-[120px]">
                        {change.fromSteward.name}
                      </span>
                      <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate max-w-[120px] text-foreground">
                        {change.toSteward.name}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUndo(change.kvvArea)}
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
