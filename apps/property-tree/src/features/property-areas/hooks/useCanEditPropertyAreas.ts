import { useCostCenterTree } from './useCostCenterTree'

export function useCanEditPropertyAreas(
  costCenterId: string | undefined
): boolean {
  const { data } = useCostCenterTree(costCenterId)
  return data?.capabilities?.canEdit ?? false
}
