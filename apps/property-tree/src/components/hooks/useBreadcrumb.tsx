import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { buildingService, propertyService, residenceService, companyService, staircaseService } from '@/services/api'

export function useBreadcrumb() {
  const location = useLocation()
  const path = location.pathname.split('/')
  const type = path[1]
  const id = path[2]
  const staircaseId = path[3] // For staircases which have buildingId/staircaseId pattern

  const companyQuery = useQuery({
    queryKey: ['breadcrumb-company', id],
    queryFn: () => companyService.getById(id),
    enabled: type === 'companies',
  })

  const propertyQuery = useQuery({
    queryKey: ['breadcrumb-property', id],
    queryFn: async () => {
      const property = await propertyService.getPropertyById(id)
      if (property._links?.parent) {
        const companyId = property._links.parent.href.split('/').pop()
        const company = await companyService.getById(companyId)
        return { ...property, company }
      }
      return property
    },
    enabled: type === 'properties',
  })

  const buildingQuery = useQuery({
    queryKey: ['breadcrumb-building', id],
    queryFn: async () => {
      const building = await buildingService.getById(id)
      if (building._links?.parent) {
        const propertyId = building._links.parent.href.split('/').pop()
        const property = await propertyService.getPropertyById(propertyId)
        const companyId = property._links?.parent?.href.split('/').pop()
        const company = companyId ? await companyService.getById(companyId) : null
        return { ...building, property, company }
      }
      return building
    },
    enabled: type === 'buildings',
  })

  const staircaseQuery = useQuery({
    queryKey: ['breadcrumb-staircase', id, staircaseId],
    queryFn: async () => {
      const staircase = await staircaseService.getByBuildingCodeAndId(id, staircaseId!)
      const building = await buildingService.getById(id)
      if (building._links?.parent) {
        const propertyId = building._links.parent.href.split('/').pop()
        const property = await propertyService.getPropertyById(propertyId)
        const companyId = property._links?.parent?.href.split('/').pop()
        const company = companyId ? await companyService.getById(companyId) : null
        return { ...staircase, building, property, company }
      }
      return { ...staircase, building }
    },
    enabled: type === 'staircases' && !!staircaseId,
  })

  const residenceQuery = useQuery({
    queryKey: ['breadcrumb-residence', id],
    queryFn: async () => {
      const residence = await residenceService.getById(id)
      if (residence._links?.parent) {
        const buildingId = residence._links.parent.href.split('/').pop()
        const building = await buildingService.getById(buildingId)
        const propertyId = building._links?.parent?.href.split('/').pop()
        const property = propertyId ? await propertyService.getPropertyById(propertyId) : null
        const companyId = property?._links?.parent?.href.split('/').pop()
        const company = companyId ? await companyService.getById(companyId) : null
        return { ...residence, building, property, company }
      }
      return residence
    },
    enabled: type === 'residences',
  })

  const items = []

  // Add company breadcrumb
  if (companyQuery.data || propertyQuery.data?.company || buildingQuery.data?.company || staircaseQuery.data?.company || residenceQuery.data?.company) {
    const company = companyQuery.data || propertyQuery.data?.company || buildingQuery.data?.company || staircaseQuery.data?.company || residenceQuery.data?.company
    items.push({
      label: company.name,
      href: `/companies/${company.id}`,
    })
  }

  // Add property breadcrumb
  if (propertyQuery.data || buildingQuery.data?.property || staircaseQuery.data?.property || residenceQuery.data?.property) {
    const property = propertyQuery.data || buildingQuery.data?.property || staircaseQuery.data?.property || residenceQuery.data?.property
    items.push({
      label: property.designation,
      href: `/properties/${property.id}`,
    })
  }

  // Add building breadcrumb
  if (buildingQuery.data || staircaseQuery.data?.building || residenceQuery.data?.building) {
    const building = buildingQuery.data || staircaseQuery.data?.building || residenceQuery.data?.building
    items.push({
      label: building.name,
      href: `/buildings/${building.id}`,
    })
  }

  // Add staircase breadcrumb
  if (staircaseQuery.data) {
    items.push({
      label: staircaseQuery.data.name || `Uppgång ${staircaseQuery.data.code}`,
      href: `/staircases/${staircaseQuery.data.building.code}/${staircaseQuery.data.id}`,
    })
  }

  // Add residence breadcrumb
  if (residenceQuery.data) {
    items.push({
      label: residenceQuery.data.name,
      href: `/residences/${residenceQuery.data.id}`,
    })
  }

  return { 
    items, 
    isLoading: companyQuery.isLoading || propertyQuery.isLoading || buildingQuery.isLoading || staircaseQuery.isLoading || residenceQuery.isLoading 
  }
}
