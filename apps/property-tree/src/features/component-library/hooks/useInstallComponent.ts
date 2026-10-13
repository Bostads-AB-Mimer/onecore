import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateComponentQueries } from '@/entities/component'

import { componentService } from '@/services/api/core/componentService'

type InstallComponentData = Parameters<
  typeof componentService.createInstanceWithInstallation
>[1]

/**
 * Hook to install a component in a space (room, facility, maintenance unit, etc.).
 *
 * @param propertyObjectId - The PropertyObject.id used as spaceId for the installation
 */
export const useInstallComponent = (propertyObjectId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: InstallComponentData) => {
      return componentService.createInstanceWithInstallation(
        propertyObjectId,
        data
      )
    },
    onSuccess: () => invalidateComponentQueries(queryClient, propertyObjectId),
  })
}
