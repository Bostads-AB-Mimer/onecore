import { useMutation, useQueryClient } from '@tanstack/react-query'

import { componentService } from '@/services/api/core/componentService'
import { toast } from '@/shared/hooks/useToast'

export const useAddSurfaceComponent = (propertyObjectId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (modelId: string) =>
      componentService.createInstanceWithInstallation(propertyObjectId, {
        modelId,
        installationDate: new Date().toISOString(),
        warrantyMonths: 0,
        priceAtPurchase: 0,
        depreciationPriceAtPurchase: 0,
        economicLifespan: 0,
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
