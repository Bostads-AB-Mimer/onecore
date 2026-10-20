import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@onecore/ui'

import { ComponentForm } from './ComponentForm'

interface ComponentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: any) => Promise<void>
  rooms: string[]
  initialData?: any
}

export function ComponentModal({
  isOpen,
  onClose,
  onSubmit,
  rooms,
  initialData,
}: ComponentModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Redigera komponent' : 'Lägg till komponent'}
          </DialogTitle>
        </DialogHeader>
        <ComponentForm
          onSubmit={onSubmit}
          onCancel={onClose}
          rooms={rooms}
          initialData={initialData}
        />
      </DialogContent>
    </Dialog>
  )
}
