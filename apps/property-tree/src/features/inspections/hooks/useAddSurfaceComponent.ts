import { useMutation, useQueryClient } from '@tanstack/react-query'

import { componentService } from '@/services/api/core/componentService'
import { toast } from '@/shared/hooks/useToast'

export const useAddSurfaceComponent = (propertyObjectId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (subtypeId: string) =>
      componentService.createInstanceWithInstallation(propertyObjectId, {
        subtypeId,
        installationDate: new Date().toISOString(),
        installationCost: 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['components', 'by-room', propertyObjectId],
      })
    },
    onError: () => {
      toast({
        title: 'Kunde inte lägga till komponent',
        description: 'Försök igen. Kontakta support om felet kvarstår.',
        variant: 'destructive',
      })
    },
  })
}
