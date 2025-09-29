export interface BreadcrumbItem {
  label: string
  path: string
}

export const getBreadcrumbLabel = (
  segment: string,
  type: 'property' | 'building' | 'residence'
): string => {
  const mappings = {
    // Properties - matchar treeData
    'odenplan-5': 'Älgen 1',
    'gotgatan-15': 'Lindaren 2',
    'sveavagen-10': 'Björnen 4',
    'pipan-1': 'Pipan 1',
    'oskaria-1': 'Oskaria 1',
    'styrhylsan-9': 'Styrhylsan 9',
    'bavern-1': 'Bävern 1',

    // Buildings - matchar treeData exakt
    'building-a': 'Bellmansgatan 1A - 2C',
    'building-b': 'Byggnad B',
    'hus-a-lindaren': 'Byggnad A',
    'kontorsbyggnad-a': 'Kontorsbyggnad A',
    'kontorsbyggnad-b': 'Kontorsbyggnad B',
    'flerfamiljshus-pipan': 'Flerfamiljshus',
    'kontorsbyggnad-oskaria': 'Kontorsbyggnad',
    'radhus-styrhylsan': 'Radhus',
    'kontorskomplex-bavern': 'Kontorskomplex',

    // Residences - konsistent med treeData
    'lgh-1001': 'LGH-1001',
    'lgh-1002': 'LGH-1002',
    'lgh-1003': 'LGH-1003',
    'lgh-2001': 'LGH-2001',
    'lgh-2002': 'LGH-2002',
    'lgh-3001': '3001',
    'lgh-3002': '3002',
    'lgh-3003': '3003',
    'kontor-101': '101',
    'kontor-102': '102',
    'kontor-201': '201',
    'kontor-202': '202',
    'lgh-4001': '4001',
    'lgh-4002': '4002',
    'lgh-5001': '5001',
    'lgh-5002': '5002',
    'kontor-301': '301',
    'kontor-302': '302',
  }

  return mappings[segment] || segment
}

export const generateBreadcrumbs = (pathname: string, propertyDetail?: any): BreadcrumbItem[] => {
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
    const propertyLabel = propertyDetail?.designation || getBreadcrumbLabel(propertySegment, 'property')
    breadcrumbs.push({
      label: propertyLabel,
      path: propertyPath,
    })

    // Add building breadcrumb if exists
    if (buildingSegment) {
      const buildingPath = `${propertyPath}/${buildingSegment}`
      breadcrumbs.push({
        label: getBreadcrumbLabel(buildingSegment, 'building'),
        path: buildingPath,
      })

      // Add residence breadcrumb if exists
      if (residenceSegment) {
        const residencePath = `${buildingPath}/${residenceSegment}`
        breadcrumbs.push({
          label: getBreadcrumbLabel(residenceSegment, 'residence'),
          path: residencePath,
        })
      }
    }
  }

  return breadcrumbs
}
