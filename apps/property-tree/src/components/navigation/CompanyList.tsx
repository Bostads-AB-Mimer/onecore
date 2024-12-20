import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '../ui/skeleton'
import { companyService } from '@/services/api'
import { CompanyNavigation } from './Company'
import { useNavigation } from '@/contexts/NavigationContext'

export function CompanyList() {
  const { setSelectedCompany, clearSelection } = useNavigation()

  const {
    data: companies,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companyService.getAll(),
  })

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-8 mx-2 mb-2" />
        <Skeleton className="h-8 mx-2 mb-2" />
        <Skeleton className="h-8 mx-2" />
      </>
    )
  }

  if (error) {
    console.error('Failed to load companies:', error)
    return (
      <div className="text-sm text-destructive px-2">
        Failed to load companies
      </div>
    )
  }

  return (
    <>
      {companies?.map((company) => (
        <CompanyNavigation
          key={company.id}
          company={company}
          onSelect={() => {
            clearSelection()
            setSelectedCompany(company)
          }}
        />
      ))}
    </>
  )
}
