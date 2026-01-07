import { useMutation, useQueryClient } from '@tanstack/react-query'
import { componentService } from '@/services/api/core/componentService'

type InstallComponentData = Parameters<
  typeof componentService.createInstanceWithInstallation
>[1]

/**
 * Hook to install a component in a room.
 * @param propertyObjectId - The PropertyObject ID to use as spaceId for the installation
 * @param roomId - Optional roomId for cache invalidation (if different from propertyObjectId)
 */
export const useInstallComponent = (
  propertyObjectId: string,
  roomId?: string
) => {
  const queryClient = useQueryClient()
  const cacheKey = roomId || propertyObjectId

  return useMutation({
    mutationFn: (data: InstallComponentData) => {
      return componentService.createInstanceWithInstallation(
        propertyObjectId,
        data
      )
    },
    onSuccess: () => {
      // Invalidate room components query to refetch
      queryClient.invalidateQueries({ queryKey: ['components', cacheKey] })
      // Invalidate uninstalled instances queries so installed instances no longer show in dropdowns
      queryClient.invalidateQueries({ queryKey: ['instances', 'uninstalled'] })
      queryClient.invalidateQueries({ queryKey: ['instances'] })
    },
  })
}
