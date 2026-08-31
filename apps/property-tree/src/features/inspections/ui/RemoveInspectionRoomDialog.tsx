import { useMutation, useQueryClient } from '@tanstack/react-query'

import { inspectionService } from '@/services/api/core/inspectionService'
import { ApiError } from '@/services/api/core/baseApi'

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
import { toast } from '@/shared/hooks/useToast'

interface RemoveInspectionRoomDialogProps {
  inspectionId: string
  // When set, the dialog is open and targets this room. Null = closed.
  roomId: string | null
  onOpenChange: (open: boolean) => void
  onRoomRemoved: (roomId: string) => void
}

export function RemoveInspectionRoomDialog({
  inspectionId,
  roomId,
  onOpenChange,
  onRoomRemoved,
}: RemoveInspectionRoomDialogProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      await inspectionService.removeInspectionRoom(inspectionId, id)
      return id
    },
    onSuccess: (id) => {
      onRoomRemoved(id)
      queryClient.invalidateQueries({
        queryKey: ['inspections-internal', inspectionId],
      })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
      onOpenChange(false)
    },
    onError: (err) => {
      const status = err instanceof ApiError ? err.status : undefined
      // 404: the room is no longer marked as added-in-this-inspection in the
      // DB (e.g. someone else removed it, or our isAddedInThisInspection was
      // stale). Refresh so the trash button disappears.
      if (status === 404) {
        queryClient.invalidateQueries({
          queryKey: ['inspections-internal', inspectionId],
        })
      }
      toast({
        title: 'Kunde inte ta bort rummet',
        description:
          status === 409
            ? 'Rummet har komponenter och kan inte tas bort.'
            : status === 404
              ? 'Rummet är inte längre tillgängligt.'
              : 'Försök igen. Kontakta support om felet kvarstår.',
      })
      onOpenChange(false)
    },
  })

  return (
    <AlertDialog
      open={roomId !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onOpenChange(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ta bort rum?</AlertDialogTitle>
          <AlertDialogDescription>
            Detta tar bort rummet från Xpand.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault()
              if (roomId) mutation.mutate(roomId)
            }}
          >
            {mutation.isPending ? 'Tar bort...' : 'Ta bort'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
