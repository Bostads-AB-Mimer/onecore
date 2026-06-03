import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { disposeKeys, undoDisposeKeys } from '@/services/disposeKeys'

/**
 * Disposes keys and shows a destructive toast with an **Ångra** (undo) action that
 * restores them. `onChanged` is called after the dispose and after an undo so the
 * caller can refresh. Returns whether the dispose succeeded (so the caller can e.g.
 * clear its selection). Shared by every "Kassera" action.
 */
export function useDisposeWithUndo() {
  const { toast } = useToast()

  return async (
    keyIds: string[],
    { onChanged }: { onChanged?: () => void | Promise<void> } = {}
  ): Promise<boolean> => {
    const result = await disposeKeys(keyIds)
    if (!result.success) {
      toast({
        title: result.title,
        description: result.message,
        variant: 'destructive',
      })
      return false
    }

    await onChanged?.()
    toast({
      title: result.title,
      description: result.message,
      duration: 10000,
      variant: 'destructive',
      className: '!w-full !p-4 !shadow-xl',
      action: (
        <ToastAction
          altText="Ångra kasseringen"
          className="!px-3 !text-sm !font-semibold !opacity-100"
          onClick={async () => {
            const undo = await undoDisposeKeys(keyIds)
            await onChanged?.()
            const undoToast = toast({
              title: undo.title,
              description: undo.message,
            })
            setTimeout(() => undoToast.dismiss(), 3000)
          }}
        >
          Ångra
        </ToastAction>
      ),
    })
    return true
  }
}
