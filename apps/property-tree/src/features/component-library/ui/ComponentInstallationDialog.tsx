import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'

import { ComponentInstallationForm } from './ComponentInstallationForm'

interface ComponentInstallationDialogProps {
  isOpen: boolean
  onClose: () => void
  propertyObjectId: string
  spaceName?: string
}

export const ComponentInstallationDialog = ({
  isOpen,
  onClose,
  propertyObjectId,
  spaceName,
}: ComponentInstallationDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Installera komponent</DialogTitle>
          {spaceName && (
            <p className="text-sm text-muted-foreground">{spaceName}</p>
          )}
        </DialogHeader>

        {isOpen && (
          <ComponentInstallationForm
            propertyObjectId={propertyObjectId}
            onSuccess={onClose}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
