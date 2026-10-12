import { Modal } from '@onecore/ui'

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Redigera komponent' : 'Lägg till komponent'}
    >
      <ComponentForm
        onSubmit={onSubmit}
        onCancel={onClose}
        rooms={rooms}
        initialData={initialData}
      />
    </Modal>
  )
}
