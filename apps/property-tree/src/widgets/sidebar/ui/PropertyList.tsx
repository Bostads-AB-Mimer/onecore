import { useProperties } from '@/features/properties'

import { Company } from '@/services/types'

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
          .sort((a, b) => a.designation.localeCompare(b.designation))
          .map((property) => (
            <PropertyNavigation
              key={property.id}
              property={property}
              companyId={company.id}
            />
          ))}
    </div>
  )
}
