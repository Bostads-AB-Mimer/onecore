import { useMutation, useQueryClient } from '@tanstack/react-query'

import { kvvAreaService } from '@/services/api/core'
import type { components } from '@/services/api/core/generated/api-types'
import { toast } from '@/shared/hooks/useToast'

type CostCenterTree = components['schemas']['CostCenterTree']
type KeycloakUser = components['schemas']['KeycloakUser']

interface UpdateKvvAreaResponsibleVariables {
  kvvAreaId: string
  keycloakUserId: string
  costCenterId: string
}

export function useUpdateKvvAreaResponsible() {
  const queryClient = useQueryClient()

  return useMutation<
    Awaited<ReturnType<typeof kvvAreaService.updateResponsible>>,
    Error,
    UpdateKvvAreaResponsibleVariables,
    { previousTree: CostCenterTree | undefined; costCenterId: string }
  >({
    mutationFn: ({ kvvAreaId, keycloakUserId }) =>
      kvvAreaService.updateResponsible(kvvAreaId, keycloakUserId),

    onMutate: async ({ kvvAreaId, keycloakUserId, costCenterId }) => {
      await queryClient.cancelQueries({
        queryKey: ['costCenterTree', costCenterId],
      })

      const previousTree = queryClient.getQueryData<CostCenterTree>([
        'costCenterTree',
        costCenterId,
      ])

      const managers =
        queryClient.getQueryData<KeycloakUser[]>([
          'propertyManagers',
          'property-manager',
        ]) ?? []
      const newResponsibleUser = managers.find((u) => u.id === keycloakUserId)

      if (previousTree && newResponsibleUser) {
        queryClient.setQueryData<CostCenterTree>(
          ['costCenterTree', costCenterId],
          {
            ...previousTree,
            kvvAreas: previousTree.kvvAreas.map((area) =>
              area.id === kvvAreaId
                ? {
                    ...area,
                    responsible: {
                      id: newResponsibleUser.id,
                      username: newResponsibleUser.username,
                      firstName: newResponsibleUser.firstName,
                      lastName: newResponsibleUser.lastName,
                      email: newResponsibleUser.email,
                      mobilePhone:
                        newResponsibleUser.attributes?.mobilePhone?.[0],
                      employeeId:
                        newResponsibleUser.attributes?.employeeId?.[0],
                    },
                  }
                : area
            ),
          }
        )
      }

      return { previousTree, costCenterId }
    },

    onError: (_err, _vars, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(
          ['costCenterTree', context.costCenterId],
          context.previousTree
        )
      }
      toast({
        title: 'Kunde inte byta ansvarig kvartersvärd',
        variant: 'destructive',
      })
    },

    onSuccess: () => {
      toast({
        title: 'Ansvarig kvartersvärd uppdaterad',
      })
    },

    onSettled: (_data, _err, _vars, context) => {
      if (context?.costCenterId) {
        queryClient.invalidateQueries({
          queryKey: ['costCenterTree', context.costCenterId],
        })
      }
    },
  })
}
