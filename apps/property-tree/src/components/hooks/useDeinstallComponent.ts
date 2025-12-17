import { useMutation, useQueryClient } from '@tanstack/react-query'
import { componentService } from '@/services/api/core/componentService'

interface DeinstallComponentData {
  installationId: string
  deinstallationDate: string
}

export const useDeinstallComponent = (roomId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: DeinstallComponentData) => {
      return componentService.deinstallComponent(
        data.installationId,
        data.deinstallationDate
      )
    },
    onSuccess: () => {
      // Invalidate room components query to refetch
      queryClient.invalidateQueries({ queryKey: ['components', roomId] })
      // Invalidate uninstalled instances queries so deinstalled instances show up in dropdowns
      queryClient.invalidateQueries({ queryKey: ['instances', 'uninstalled'] })
      queryClient.invalidateQueries({ queryKey: ['instances'] })
    },
  })
}
