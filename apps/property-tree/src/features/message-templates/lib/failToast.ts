import { toast } from '@/shared/hooks/useToast'
import { errorCodeOf, templateErrorText } from '@/shared/lib/templateErrorText'

// A save someone else got in first gets its own warning in the form.
export const failToast = (title: string, error: unknown) => {
  if (errorCodeOf(error) === 'TEMPLATE_CHANGED') return
  toast({
    title,
    description: templateErrorText(errorCodeOf(error)) ?? undefined,
    variant: 'destructive',
  })
}
