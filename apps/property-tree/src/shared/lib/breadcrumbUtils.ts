import { paths } from '@/shared/routes'

export interface BreadcrumbItem {
  label: string
  path: string
}

export const generateBreadcrumbs = (
  property?: { code: string; name: string },
  building?: { code: string; name: string },
  residence?: { rentalId: string; name: string },
  organizationNumber?: string
): BreadcrumbItem[] => {
  const breadcrumbs: BreadcrumbItem[] = []

  // Always start with Properties - link to company if available
  breadcrumbs.push({
    label: 'Fastigheter',
    path: organizationNumber ? paths.company(organizationNumber) : '/',
  })

  // Add property breadcrumb if provided
  if (property) {
    breadcrumbs.push({
      label: property.name,
      path: paths.property(property.code),
    })

    // Add building breadcrumb if provided
    if (building) {
      breadcrumbs.push({
        label: building.name,
        path: paths.building(building.code),
      })

      // Add residence breadcrumb if provided
      if (residence) {
        breadcrumbs.push({
          label: residence.name,
          path: paths.residence(residence.rentalId),
        })
      }
    }
  }

  return breadcrumbs
}
