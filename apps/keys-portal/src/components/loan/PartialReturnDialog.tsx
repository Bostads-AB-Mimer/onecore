import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, KeyRound } from 'lucide-react'
import type { Key } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'

interface PartialReturnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  keys: Key[]
  onConfirm: (selectedKeyIds: string[], isReplacement: boolean) => void
  isProcessing?: boolean
}

export function PartialReturnDialog({
  open,
  onOpenChange,
  keys,
  onConfirm,
  isProcessing = false,
}: PartialReturnDialogProps) {
  // Initialize with all keys selected
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(
    new Set(keys.map((k) => k.id))
  )
  const [isReplacement, setIsReplacement] = useState(false)

  // Reset state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSelectedKeyIds(new Set(keys.map((k) => k.id)))
      setIsReplacement(false)
    }
    onOpenChange(newOpen)
  }

  const handleToggleKey = (keyId: string) => {
    const newSet = new Set(selectedKeyIds)
    if (newSet.has(keyId)) {
      newSet.delete(keyId)
    } else {
      newSet.add(keyId)
    }
    setSelectedKeyIds(newSet)
  }

  const handleSelectAll = () => {
    setSelectedKeyIds(new Set(keys.map((k) => k.id)))
  }

  const handleDeselectAll = () => {
    setSelectedKeyIds(new Set())
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedKeyIds), isReplacement)
  }

  const returnedCount = selectedKeyIds.size
  const missingCount = keys.length - returnedCount
  const hasMissingKeys = missingCount > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Returkvitto för nycklar
          </DialogTitle>
          <DialogDescription>
            Välj vilka nycklar som återlämnas. Avmarkera nycklar som saknas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="bg-muted rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Totalt antal nycklar:</span>
              <span className="font-medium">{keys.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Återlämnade:</span>
              <span className="font-medium text-green-600">
                {returnedCount}
              </span>
            </div>
            {hasMissingKeys && (
              <div className="flex justify-between text-sm">
                <span>Saknade:</span>
                <span className="font-medium text-red-600">{missingCount}</span>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="flex-1"
            >
              Välj alla
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
              className="flex-1"
            >
              Avmarkera alla
            </Button>
          </div>

          {/* Keys list with checkboxes */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
            {keys.map((key) => {
              const isSelected = selectedKeyIds.has(key.id)
              const keyTypeLabel =
                (KeyTypeLabels as Record<string, string>)[
                  key.keyType as unknown as string
                ] || key.keyType

              return (
                <div
                  key={key.id}
                  className={`flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer ${
                    !isSelected ? 'opacity-60' : ''
                  }`}
                  onClick={() => handleToggleKey(key.id)}
                >
                  <Checkbox
                    id={`key-${key.id}`}
                    checked={isSelected}
                    onCheckedChange={() => handleToggleKey(key.id)}
                  />
                  <label
                    htmlFor={`key-${key.id}`}
                    className="flex-1 cursor-pointer select-none"
                  >
                    <div className="font-medium text-sm">{key.keyName}</div>
                    <div className="text-xs text-muted-foreground">
                      {keyTypeLabel}
                      {key.keySequenceNumber &&
                        ` • Sek.nr: ${key.keySequenceNumber}`}
                    </div>
                  </label>
                  {!isSelected && (
                    <Badge variant="destructive" className="text-xs">
                      Saknas
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>

          {/* Replacement mode toggle */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id="replacement-mode"
                checked={isReplacement}
                onCheckedChange={(checked) =>
                  setIsReplacement(checked === true)
                }
              />
              <div className="flex-1">
                <label
                  htmlFor="replacement-mode"
                  className="text-sm font-medium cursor-pointer"
                >
                  Detta är ett byte av drop/nyckel
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Markera detta om du byter ut en drop/nyckel under pågående
                  hyresavtal. Ett nytt utlåningskvitto kommer att skapas
                  automatiskt.
                </p>
              </div>
            </div>
          </div>

          {/* Warning for missing keys */}
          {hasMissingKeys && (
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-600 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-yellow-800 dark:text-yellow-200">
                  <p className="font-semibold">Varning: Saknade nycklar</p>
                  <p className="mt-1">
                    {missingCount}{' '}
                    {missingCount === 1 ? 'nyckel saknas' : 'nycklar saknas'}.
                    {isReplacement
                      ? ' Ett nytt lån med alla nycklar kommer att skapas.'
                      : ' Saknade nycklar kommer att markeras på kvittot.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing
              ? 'Bearbetar...'
              : isReplacement
                ? 'Skapa returkvitto & Nytt lån'
                : 'Skapa returkvitto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
