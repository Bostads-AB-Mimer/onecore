import { useMutation, useQueryClient } from '@tanstack/react-query'
import { componentService } from '@/services/api/core/componentService'

type InstallComponentData = Parameters<
  typeof componentService.createInstanceWithInstallation
>[1]

export const useInstallComponent = (roomId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: InstallComponentData) => {
      return componentService.createInstanceWithInstallation(roomId, data)
    },
    onSuccess: () => {
      // Invalidate room components query to refetch
      queryClient.invalidateQueries({ queryKey: ['components', roomId] })
      // Invalidate uninstalled instances queries so installed instances no longer show in dropdowns
      queryClient.invalidateQueries({ queryKey: ['instances', 'uninstalled'] })
      queryClient.invalidateQueries({ queryKey: ['instances'] })
    },
  })
}
