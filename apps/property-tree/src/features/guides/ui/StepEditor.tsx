import { useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/AlertDialog'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import { RichTextEditor } from '@/shared/ui/RichTextEditor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
import {
  SortableHandle,
  type SortableHandleProps,
} from '@/shared/ui/SortableList'
import { Textarea } from '@/shared/ui/Textarea'

import { CALLOUT_OPTIONS } from '../constants'
import type {
  CalloutType,
  EditorAction,
  EditorStep,
  StepPatch,
} from '../lib/editorState'
import { StepImageEditor } from './StepImageEditor'

// Sentinel for "no callout" since Select values must be non-empty strings.
const NO_CALLOUT = 'none'

interface StepEditorProps {
  guideId: string | null
  /** True when the guide is published on the server; uploads need alt text. */
  guidePublished: boolean
  step: EditorStep
  index: number
  total: number
  handle: SortableHandleProps
  dispatch: React.Dispatch<EditorAction>
  /** Reports how many uploads the step currently has in flight. */
  onPendingChange: (stepId: string, count: number) => void
  /** True while the guide is being saved; the form is read-only then. */
  disabled: boolean
}

export function StepEditor({
  guideId,
  guidePublished,
  step,
  index,
  total,
  handle,
  dispatch,
  onPendingChange,
  disabled,
}: StepEditorProps) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const stepNumber = index + 1
  const titleId = `step-${step.id}-title`
  const bodyId = `step-${step.id}-body`

  const update = (patch: StepPatch) =>
    dispatch({ type: 'update-step', stepId: step.id, patch })

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <SortableHandle {...handle} label={`Dra steg ${stepNumber}`} />
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {stepNumber}
        </span>
        <span className="text-sm font-medium">Steg {stepNumber}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={index === 0}
            onClick={() =>
              dispatch({ type: 'move-step', from: index, to: index - 1 })
            }
            aria-label={`Flytta steg ${stepNumber} upp`}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={index === total - 1}
            onClick={() =>
              dispatch({ type: 'move-step', from: index, to: index + 1 })
            }
            aria-label={`Flytta steg ${stepNumber} ned`}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => setConfirmRemove(true)}
            aria-label={`Ta bort steg ${stepNumber}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={titleId}>Rubrik</Label>
          <Input
            id={titleId}
            value={step.title}
            onChange={(event) => update({ title: event.target.value })}
            placeholder="T.ex. Öppna kontraktet i Tenfast"
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={bodyId}>Beskrivning</Label>
          <RichTextEditor
            id={bodyId}
            value={step.body}
            onChange={(body) => update({ body })}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label>Bilder</Label>
          <StepImageEditor
            guideId={guideId}
            requireAltText={guidePublished}
            step={step}
            dispatch={dispatch}
            onPendingChange={onPendingChange}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            <Label htmlFor={`step-${step.id}-callout`}>Ruta</Label>
            <Select
              value={step.calloutType ?? NO_CALLOUT}
              onValueChange={(value) =>
                update({
                  calloutType:
                    value === NO_CALLOUT ? null : (value as CalloutType),
                })
              }
            >
              <SelectTrigger id={`step-${step.id}-callout`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CALLOUT}>Ingen</SelectItem>
                {CALLOUT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {step.calloutType && (
            <div className="space-y-2">
              <Label htmlFor={`step-${step.id}-callout-text`}>
                Text i rutan
              </Label>
              <Textarea
                id={`step-${step.id}-callout-text`}
                value={step.calloutText}
                onChange={(event) =>
                  update({ calloutText: event.target.value })
                }
                rows={2}
                maxLength={2000}
              />
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort steg {stepNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              Steget tas bort när guiden sparas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => dispatch({ type: 'remove-step', stepId: step.id })}
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
