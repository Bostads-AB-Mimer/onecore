import { useQuery } from '@tanstack/react-query'
import { companyService, propertyService } from '@/services/api/core'

/**
 * Finds which company owns a given property.
 * Checks companies 001 and 006 (001 contains all properties except one, which is in 006).
 */
export function useCompanyByPropertyId(propertyId: string | undefined) {
  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: () => companyService.getAll(),
    enabled: !!propertyId,
  })

  return useQuery({
    queryKey: ['propertyCompany', propertyId],
    queryFn: async () => {
      const allCompanies = companiesQuery.data
      if (!allCompanies) return null

      // Only check companies 001 and 006, with 001 first (most likely)
      const relevantCompanies = allCompanies
        .filter((c) => c.code === '001' || c.code === '006')
        .sort((a, b) => {
          if (a.code === '001') return -1
          if (b.code === '001') return 1
          return 0
        })

      for (const company of relevantCompanies) {
        try {
          const properties = await propertyService.getFromCompany(company)
          if (properties?.some((p: any) => p.id === propertyId)) {
            return company
          }
        } catch (error) {
          continue
        }
      }
      return null
    },
    enabled: !!propertyId && !!companiesQuery.data,
  })
}
