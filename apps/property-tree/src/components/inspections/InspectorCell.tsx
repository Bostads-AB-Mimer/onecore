import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog'
import { Textarea } from '@/components/ui/Textarea'
import {
  AVAILABLE_INSPECTORS,
  type ExtendedInspection,
} from './mockdata/mockInspections'

interface InspectorCellProps {
  inspection: ExtendedInspection
  readOnly?: boolean
  onUpdate: (id: string, updates: Partial<ExtendedInspection>) => void
}

export function InspectorCell({
  inspection,
  readOnly = false,
  onUpdate,
}: InspectorCellProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingInspector, setPendingInspector] = useState<string | undefined>()
  const [changeReason, setChangeReason] = useState<string>('')
  const [changeComment, setChangeComment] = useState<string>('')

  // Om readOnly, visa bara resursens namn
  if (readOnly) {
    return (
      <span className="text-sm">
        {inspection.assignedInspector || 'Ej tilldelad'}
      </span>
    )
  }

  const handleValueChange = (value: string) => {
    const newInspector = value === 'none' ? undefined : value

    // Om besiktningen redan är tilldelad och man väljer en ny resurs
    if (
      inspection.assignedInspector &&
      inspection.assignedInspector !== newInspector
    ) {
      setPendingInspector(newInspector)
      setShowConfirmDialog(true)
    } else {
      // Direkt uppdatering om ingen är tilldelad eller om man tar bort tilldelningen
      onUpdate(inspection.id, {
        assignedInspector: newInspector,
        isAssigned: value !== 'none',
      })
    }
  }

  const handleConfirmChange = () => {
    onUpdate(inspection.id, {
      assignedInspector: pendingInspector,
      isAssigned: pendingInspector !== undefined,
    })

    // Rensa state
    setShowConfirmDialog(false)
    setPendingInspector(undefined)
    setChangeReason('')
    setChangeComment('')
  }

  const handleCancelChange = () => {
    setShowConfirmDialog(false)
    setPendingInspector(undefined)
    setChangeReason('')
    setChangeComment('')
  }

  return (
    <>
      <Select
        value={inspection.assignedInspector || 'none'}
        onValueChange={handleValueChange}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Ej tilldelad</SelectItem>
          {AVAILABLE_INSPECTORS.map((inspector) => (
            <SelectItem key={inspector} value={inspector}>
              {inspector}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekräfta byte av resurs</AlertDialogTitle>
            <AlertDialogDescription>
              Du håller på att byta resurs från{' '}
              <strong>{inspection.assignedInspector}</strong> till{' '}
              <strong>{pendingInspector || 'Ej tilldelad'}</strong>. Vänligen
              ange anledning till bytet.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Anledning *</label>
              <Select value={changeReason} onValueChange={setChangeReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj anledning" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sjukdom">Sjukdom</SelectItem>
                  <SelectItem value="semester">Semester</SelectItem>
                  <SelectItem value="schema-konflikt">
                    Schema-konflikt
                  </SelectItem>
                  <SelectItem value="resursbrist">Resursbrist</SelectItem>
                  <SelectItem value="annat">Annat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Kommentar (valfritt)
              </label>
              <Textarea
                placeholder="Ange ytterligare information om bytet..."
                value={changeComment}
                onChange={(e) => setChangeComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelChange}>
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmChange}
              disabled={!changeReason}
            >
              Bekräfta byte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
