import { useState } from 'react'
import { Trash2 } from 'lucide-react'

import type { RelationRoleType } from '@/services/api/core/tenantService'

import { useToast } from '@/shared/hooks/useToast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/AlertDialog'
import { Button } from '@/shared/ui/Button'

import { useRemoveRelation } from '../hooks/useRemoveRelation'
import { relationErrorMessage } from '../lib/relationRoles'

interface RemoveRelationButtonProps {
  contactCode: string
  relatedContactCode: string
  relatedName: string
  roleType: RelationRoleType
  roleLabel: string
}

export const RemoveRelationButton = ({
  contactCode,
  relatedContactCode,
  relatedName,
  roleType,
  roleLabel,
}: RemoveRelationButtonProps) => {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const removeRelation = useRemoveRelation()
  const lowerLabel = roleLabel.toLowerCase()

  const confirm = () =>
    removeRelation.mutate(
      { contactCode, relatedContactCode, roleType },
      {
        onSuccess: () => {
          setOpen(false)
          toast({ title: `${roleLabel} borttagen`, description: relatedName })
        },
        onError: (error) => {
          setOpen(false)
          toast({
            variant: 'destructive',
            title: 'Kunde inte ta bort',
            description: relationErrorMessage(error?.error, error?.detail),
          })
        },
      }
    )

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && removeRelation.isPending) return
        setOpen(next)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Ta bort ${lowerLabel}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ta bort {lowerLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            {relatedName} ({relatedContactCode}) tas bort som {lowerLabel}.
            Historiken sparas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeRelation.isPending}>
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={removeRelation.isPending}
            onClick={(e) => {
              e.preventDefault()
              confirm()
            }}
          >
            {removeRelation.isPending ? 'Tar bort...' : 'Ta bort'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
