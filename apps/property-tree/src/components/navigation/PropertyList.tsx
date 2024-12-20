import React from 'react'
import { Company } from '@/services/types'
import { Skeleton } from '../ui/skeleton'
import { SidebarMenu } from '../ui/sidebar'
import { PropertyNavigation } from './Property'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@/services/api'

interface PropertyListProps {
  company: Company
}

export function PropertyList({ company }: PropertyListProps) {
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
      <>
        <Skeleton className="h-8 mx-2 mb-2" />
        <Skeleton className="h-8 mx-2" />
      </>
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
        <PropertyNavigation key={property.id} property={property} />
      ))}
    </SidebarMenu>
  )
}
