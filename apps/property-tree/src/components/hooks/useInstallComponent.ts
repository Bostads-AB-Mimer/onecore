import { useMutation, useQueryClient } from '@tanstack/react-query'
import { componentService } from '@/services/api/core/componentService'

type InstallComponentData = Parameters<
  typeof componentService.createInstanceWithInstallation
>[1]

/**
 * Hook to install a component in a room.
 *
 * ID Naming Convention:
 * - `propertyObjectId` (keycmobj format, Char(15)): The PropertyObject.id used as `spaceId`
 *   in the component installation. This is Room.propertyObjectId, NOT Room.id.
 * - `roomId` (keyrumsb format, Char(15)): The Room.id, used only for cache invalidation.
 *   This is different from propertyObjectId - each room has both IDs.
 *
 * The API expects `spaceId` to be a PropertyObject ID (keycmobj), not a Room ID (keyrumsb).
 *
 * @param propertyObjectId - The PropertyObject.id (keycmobj) to use as spaceId for the installation
 * @param roomId - Optional Room.id (keyrumsb) for cache invalidation (defaults to propertyObjectId)
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
