import { useProperties } from '@/features/properties'

import { Company } from '@/services/types'

import { numericCompare } from '@/shared/lib/sorting'
import { NavigationError, NavigationSkeleton } from '@/shared/ui/layout'

import { PropertyNavigation } from './Property'

interface PropertyListProps {
  company: Company
}

export function PropertyList({ company }: PropertyListProps) {
  const { data: properties, isLoading, error } = useProperties(company)

  if (isLoading) return <NavigationSkeleton />
  if (error) return <NavigationError label="properties" />

  return (
    <div className="space-y-2">
      {properties &&
        properties
          .slice()
          .sort((a, b) => numericCompare(a.designation, b.designation))
          .map((property) => (
            <PropertyNavigation
              key={property.id}
              property={property}
              organizationNumber={company.organizationNumber ?? undefined}
            />
          ))}
    </div>
  )
}
