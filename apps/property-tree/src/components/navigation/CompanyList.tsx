import React from 'react'
import { SidebarMenu } from '../ui/sidebar'
import { CompanyNavigation } from './Company'
import { useQuery } from '@tanstack/react-query'
import { companyService } from '@/services/api'

interface CompanyListProps {
  onCompanySelect?: (companyId: string) => void
}

export function CompanyList({ onCompanySelect }: CompanyListProps) {
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
      <div className="animate-pulse h-8 bg-sidebar-accent/10 rounded-md" />
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
    <SidebarMenu>
      {companies?.map((company) => (
        <CompanyNavigation
          key={company.id}
          company={company}
          onSelect={() => onCompanySelect?.(company.id)}
        />
      ))}
    </SidebarMenu>
  )
}
