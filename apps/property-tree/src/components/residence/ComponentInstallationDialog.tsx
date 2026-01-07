import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v2/Dialog'
import { ComponentInstallationForm } from './ComponentInstallationForm'

interface ComponentInstallationDialogProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  propertyObjectId: string
  roomName?: string
}

export const ComponentInstallationDialog = ({
  isOpen,
  onClose,
  roomId,
  propertyObjectId,
  roomName,
}: ComponentInstallationDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Installera komponent</DialogTitle>
          {roomName && (
            <p className="text-sm text-muted-foreground">Rum: {roomName}</p>
          )}
        </DialogHeader>

        {isOpen && (
          <ComponentInstallationForm
            propertyObjectId={propertyObjectId}
            roomId={roomId}
            onSuccess={onClose}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
