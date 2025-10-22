export interface BreadcrumbItem {
  label: string
  path: string
}

export const generateBreadcrumbs = (
  property?: { id: string; name: string },
  building?: { id: string; name: string },
  residence?: { id: string; name: string },
  companyId?: string
): BreadcrumbItem[] => {
  const breadcrumbs: BreadcrumbItem[] = []

  // Always start with Properties - link to company if available
  breadcrumbs.push({
    label: 'Fastigheter',
    path: companyId ? `/companies/${companyId}` : '/',
  })

  // Add property breadcrumb if provided
  if (property) {
    breadcrumbs.push({
      label: property.name,
      path: `/properties/${property.id}`,
    })

    // Add building breadcrumb if provided
    if (building) {
      breadcrumbs.push({
        label: building.name,
        path: `/building/${building.id}`,
      })

      // Add residence breadcrumb if provided
      if (residence) {
        breadcrumbs.push({
          label: residence.name,
          path: `/residence/${residence.id}`,
        })
      }
    }
  }

  return breadcrumbs
}
