import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  type CreateReleaseNote,
  RELEASE_NOTES_QUERY_KEY,
  type UpdateReleaseNote,
} from '@/entities/release-note'

import { releaseNoteService } from '@/services/api/core/releaseNoteService'

import { toast } from '@/shared/hooks/useToast'

function useInvalidateReleaseNotes() {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: [RELEASE_NOTES_QUERY_KEY] })
}

export function useCreateReleaseNote() {
  const invalidate = useInvalidateReleaseNotes()

  return useMutation({
    mutationFn: (body: CreateReleaseNote) => releaseNoteService.create(body),
    onSuccess: () => {
      toast({ title: 'Nyheten skapades' })
      return invalidate()
    },
    onError: () => {
      toast({ title: 'Kunde inte skapa nyheten', variant: 'destructive' })
    },
  })
}

export function useUpdateReleaseNote() {
  const invalidate = useInvalidateReleaseNotes()

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateReleaseNote }) =>
      releaseNoteService.update(id, body),
    onSuccess: () => {
      toast({ title: 'Nyheten uppdaterades' })
      return invalidate()
    },
    onError: () => {
      toast({ title: 'Kunde inte uppdatera nyheten', variant: 'destructive' })
    },
  })
}

export function useDeleteReleaseNote() {
  const invalidate = useInvalidateReleaseNotes()

  return useMutation({
    mutationFn: (id: string) => releaseNoteService.remove(id),
    onSuccess: () => {
      toast({ title: 'Nyheten togs bort' })
      return invalidate()
    },
    onError: () => {
      toast({ title: 'Kunde inte ta bort nyheten', variant: 'destructive' })
    },
  })
}
