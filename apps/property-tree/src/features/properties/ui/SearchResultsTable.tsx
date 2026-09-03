import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { numericCompare } from '@/shared/lib/sorting'
import { paths } from '@/shared/routes'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ResponsiveTable } from '@/shared/ui/ResponsiveTable'

import type { SearchResult } from '../types'

interface SearchResultsTableProps {
  results: SearchResult[]
}

export const SearchResultsTable = ({ results }: SearchResultsTableProps) => {
  const hasProperties = results.some((r) => r.type === 'property')
  const hasMaintenanceUnits = results.some((r) => r.type === 'maintenance-unit')

  const getTypeDisplay = (result: SearchResult) => {
    switch (result.type) {
      case 'property':
        return 'Fastighet'
      case 'maintenance-unit':
        return result.maintenanceType || 'Underhållsenhet'
    }
  }

  const getTypeColorClass = (type: string) => {
    switch (type) {
      case 'property':
        return 'bg-blue-100 text-blue-800'
      case 'maintenance-unit':
        return 'bg-teal-100 text-teal-800'
      default:
        return 'bg-slate-100'
    }
  }

  const getPath = (result: SearchResult) => {
    switch (result.type) {
      case 'property':
        return paths.property(result.code)
      case 'maintenance-unit':
        return paths.maintenanceUnit(result.code)
    }
  }

  const getName = (result: SearchResult) => {
    switch (result.type) {
      case 'property':
        return result.designation
      case 'maintenance-unit':
        return result.caption || result.code
    }
  }

  const getSecondaryInfo = (result: SearchResult) => result.code

  const sortedResults = useMemo(
    () =>
      results.slice().sort((a, b) => {
        const nameCompare = numericCompare(getName(a) || '', getName(b) || '')
        if (nameCompare !== 0) return nameCompare
        return numericCompare(
          getSecondaryInfo(a) || '',
          getSecondaryInfo(b) || ''
        )
      }),
    [results]
  )

  return (
    <ResponsiveTable
      data={sortedResults}
      columns={[
        {
          key: 'name',
          label: 'Namn',
          render: (result) => (
            <span className="font-medium">{getName(result)}</span>
          ),
        },
        {
          key: 'info',
          label:
            hasProperties && !hasMaintenanceUnits
              ? 'Fastighetsnummer'
              : !hasProperties
                ? 'Objektsnummer'
                : 'Information',
          render: (result) => getSecondaryInfo(result),
          hideOnMobile: true,
        },
        {
          key: 'type',
          label: 'Typ',
          render: (result) => (
            <Badge variant="outline" className={getTypeColorClass(result.type)}>
              {getTypeDisplay(result)}
            </Badge>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          render: () => '-',
          hideOnMobile: true,
        },
        {
          key: 'action',
          label: 'Åtgärd',
          render: (result) => (
            <Button asChild variant="link" size="sm">
              <Link to={getPath(result)}>Visa detaljer</Link>
            </Button>
          ),
          className: 'text-right',
        },
      ]}
      keyExtractor={(result) => `${result.type}-${result.id}`}
      emptyMessage="Inga resultat hittades med angivna sökkriterier"
      mobileCardRenderer={(result) => (
        <div className="space-y-2 w-full">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium">{getName(result)}</div>
              <div className="text-sm text-muted-foreground">
                {getSecondaryInfo(result)}
              </div>
            </div>
            <Badge variant="outline" className={getTypeColorClass(result.type)}>
              {getTypeDisplay(result)}
            </Badge>
          </div>
          <div className="flex justify-end">
            <Button asChild variant="link" size="sm">
              <Link to={getPath(result)}>Visa detaljer</Link>
            </Button>
          </div>
        </div>
      )}
    />
  )
}
