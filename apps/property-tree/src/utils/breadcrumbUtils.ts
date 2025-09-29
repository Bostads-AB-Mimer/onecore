export interface BreadcrumbItem {
  label: string
  path: string
}

export const generateBreadcrumbs = (
  pathname: string,
  propertyDetail?: any
): BreadcrumbItem[] => {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  // Always start with Properties
  breadcrumbs.push({
    label: 'Fastigheter',
    path: '/properties',
  })

  if (segments.length < 2) return breadcrumbs // Need at least /properties/property

  // Extract relevant segments: skip 'properties'
  const propertySegment = segments[1] // The property segment
  const buildingSegment = segments[2] // The building segment (if exists)
  const residenceSegment = segments[3] // The residence segment (if exists)

  if (propertySegment) {
    // Add property breadcrumb
    const propertyPath = `/properties/${propertySegment}`
    const propertyLabel = propertyDetail?.designation
    breadcrumbs.push({
      label: propertyLabel,
      path: propertyPath,
    })

    // Add building breadcrumb if exists
    if (buildingSegment) {
      const buildingPath = `${propertyPath}/${buildingSegment}`
      breadcrumbs.push({
        label: buildingSegment,
        path: buildingPath,
      })

      // Add residence breadcrumb if exists
      if (residenceSegment) {
        const residencePath = `${buildingPath}/${residenceSegment}`
        breadcrumbs.push({
          label: residenceSegment,
          path: residencePath,
        })
      }
    }
  }

  return breadcrumbs
}
