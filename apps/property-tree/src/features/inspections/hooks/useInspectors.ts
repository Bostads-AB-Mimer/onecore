import { useQuery } from '@tanstack/react-query'

import { authService } from '@/services/api/core'

export function useInspectors() {
  return useQuery({
    queryKey: ['inspectors', 'inspections:write'],
    queryFn: () => authService.getUsersByRole('inspections:write'),
  })
}
