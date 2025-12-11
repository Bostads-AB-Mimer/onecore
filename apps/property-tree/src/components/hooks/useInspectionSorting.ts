import { useState } from 'react'
import { Button } from '@/components/ui/v2/Button'
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { ExtendedInspection } from '@/components/inspections/mockdata/mockInspections'

export type SortField = 'priority' | 'contractId' | 'terminationDate'
export type SortDirection = 'asc' | 'desc'

export function useInspectionSorting() {
  const [sortField, setSortField] = useState<SortField>('terminationDate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortInspections = (inspections: ExtendedInspection[]) => {
    return [...inspections].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case 'priority':
          aValue = a.priority === 'avflytt' ? 0 : 1
          bValue = b.priority === 'avflytt' ? 0 : 1
          break
        case 'contractId':
          aValue = a.contractId || ''
          bValue = b.contractId || ''
          break
        case 'terminationDate':
          aValue = new Date(a.terminationDate || '').getTime()
          bValue = new Date(b.terminationDate || '').getTime()
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
