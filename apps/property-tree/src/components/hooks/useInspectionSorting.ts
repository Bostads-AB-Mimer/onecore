import { useState } from 'react'
import type { ExternalInspection } from '@/services/api/core/inspectionService'

export type SortField = 'leaseId' | 'address' | 'date'
export type SortDirection = 'asc' | 'desc'

export function useInspectionSorting() {
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortInspections = (inspections: ExternalInspection[]) => {
    return [...inspections].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case 'leaseId':
          aValue = a.leaseId || ''
          bValue = b.leaseId || ''
          break
        case 'address':
          aValue = a.address || ''
          bValue = b.address || ''
          break
        case 'date':
          aValue = a.date ? new Date(a.date).getTime() : 0
          bValue = b.date ? new Date(b.date).getTime() : 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  return {
    sortField,
    sortDirection,
    handleSort,
    sortInspections,
  }
}
