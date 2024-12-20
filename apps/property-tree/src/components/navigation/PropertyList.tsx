import React from 'react'
import { Company } from '@/services/types'
import { SidebarMenu } from '../ui/sidebar'
import { PropertyNavigation } from './Property'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@/services/api'
import { useNavigation } from '@/contexts/NavigationContext'

interface PropertyListProps {
  company: Company
}

export function PropertyList({ company }: PropertyListProps) {
  const { setSelectedProperty, setSelectedBuilding, setSelectedStaircase, setSelectedResidence } = useNavigation()
  
  const {
    data: properties,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['propertiesForCompanyId', company.id],
    queryFn: async () => propertyService.getFromCompany(company),
  })

  if (isLoading) {
    return (
      <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
    )
  }

  if (error) {
    console.error(`Failed to load properties for company ${company.id}:`, error)
    return (
      <div className="text-sm text-destructive px-2">
        Failed to load properties
      </div>
    )
  }

  return (
    <SidebarMenu>
      {properties?.map((property) => (
        <PropertyNavigation
          key={property.id}
          property={property}
          onSelect={() => {
            setSelectedProperty(property)
            setSelectedBuilding(null)
            setSelectedStaircase(null)
            setSelectedResidence(null)
          }}
        />
      ))}
    </SidebarMenu>
  )
}
