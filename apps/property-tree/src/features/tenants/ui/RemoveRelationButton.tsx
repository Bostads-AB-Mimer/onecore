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
import { relationErrorMessage } from '../lib/relations'

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
  const { toast } = useToast()
  const removeRelation = useRemoveRelation()
  const lowerLabel = roleLabel.toLowerCase()

  const confirm = () =>
    removeRelation.mutate(
      { contactCode, relatedContactCode, roleType },
      {
        onSuccess: () =>
          toast({ title: `${roleLabel} borttagen`, description: relatedName }),
        onError: (error) =>
          toast({
            variant: 'destructive',
            title: 'Kunde inte ta bort',
            description: relationErrorMessage(error?.error),
          }),
      }
    )

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Ta bort ${lowerLabel}`}>
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
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={removeRelation.isPending}
          >
            Ta bort
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
