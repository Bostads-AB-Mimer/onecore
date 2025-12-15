import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/v2/Dialog'
import { Button } from '@/components/ui/v2/Button'
import { Label } from '@/components/ui/v2/Label'
import { Input } from '@/components/ui/Input'
import { AlertCircle } from 'lucide-react'
import { useDeinstallComponent } from '@/components/hooks/useDeinstallComponent'
import type { ComponentInstance } from '@/services/types'

interface DeinstallationDialogProps {
  isOpen: boolean
  onClose: () => void
  component: ComponentInstance
  roomId: string
}

export const DeinstallationDialog = ({
  isOpen,
  onClose,
  component,
  roomId,
}: DeinstallationDialogProps) => {
  const [deinstallationDate, setDeinstallationDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const deinstallMutation = useDeinstallComponent(roomId)

  const handleDeinstall = async () => {
    // Find the installation ID from the component's installations
    const activeInstallation = component.componentInstallations?.find(
      (inst) => !inst.deinstallationDate
    )

    if (!activeInstallation) {
      console.error('No active installation found for component')
      return
    }

    try {
      await deinstallMutation.mutateAsync({
        installationId: activeInstallation.id,
        deinstallationDate,
      })
      onClose()
    } catch (error) {
      console.error('Failed to deinstall component:', error)
    }
  }

  const handleClose = () => {
    if (!deinstallMutation.isPending) {
      // Reset date to today when closing
      setDeinstallationDate(new Date().toISOString().split('T')[0])
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Avinstallera komponent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Message */}
          <div className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">
                Du är på väg att avinstallera denna komponent
              </p>
              <p className="text-amber-700 dark:text-amber-300">
                Komponenten kommer att markeras som avinstallerad och kommer
                inte längre visas i rummet. Historiken bevaras.
              </p>
            </div>
          </div>

          {/* Component Information */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-md">
            <div>
              <p className="text-sm text-muted-foreground">Komponent</p>
              <p className="font-medium">
                {component.model?.subtype?.componentType?.category
                  ?.categoryName || ''}{' '}
                - {component.model?.manufacturer} {component.model?.modelName}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Serienummer</p>
              <p className="font-mono text-sm">{component.serialNumber}</p>
            </div>
          </div>

          {/* Deinstallation Date */}
          <div>
            <Label htmlFor="deinstallation-date">Avinstallationsdatum</Label>
            <Input
              id="deinstallation-date"
              type="date"
              value={deinstallationDate}
              onChange={(e) => setDeinstallationDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ange när komponenten avinstallerades
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={deinstallMutation.isPending}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeinstall}
            disabled={deinstallMutation.isPending}
          >
            {deinstallMutation.isPending ? 'Avinstallerar...' : 'Avinstallera'}
          </Button>
        </DialogFooter>

        {deinstallMutation.isError && (
          <p className="text-sm text-destructive text-center">
            Ett fel uppstod vid avinstallation. Försök igen.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
