import { useCallback } from 'react'

import { useToast } from '@/shared/hooks/useToast'

/**
 * Copy text to the clipboard and confirm with a toast. Returns a function
 * that resolves to whether the copy succeeded.
 */
export function useCopyToClipboard(successTitle = 'Länk kopierad') {
  const { toast } = useToast()

  return useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        toast({ title: successTitle })
        return true
      } catch {
        toast({
          title: 'Kunde inte kopiera',
          description: 'Markera och kopiera länken manuellt.',
          variant: 'destructive',
        })
        return false
      }
    },
    [toast, successTitle]
  )
}
