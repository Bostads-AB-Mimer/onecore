import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateComponentQueries } from '@/entities/component'

import { componentService } from '@/services/api/core/componentService'

interface DeinstallComponentData {
  installationId: string
  deinstallationDate: string
}

export const useDeinstallComponent = (spaceId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: DeinstallComponentData) => {
      return componentService.deinstallComponent(
        data.installationId,
        data.deinstallationDate
      )
    },
    onSuccess: () => invalidateComponentQueries(queryClient, spaceId),
  })
}
