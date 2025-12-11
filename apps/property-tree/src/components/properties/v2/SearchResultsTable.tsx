import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/v2/Badge'
import { Button } from '@/components/ui/v2/Button'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'

export type SearchResult =
  | {
      type: 'property'
      id: string
      code: string
      designation: string
      municipality: string
    }
  | {
      type: 'residence'
      id: string
      code: string
      name: string | null
      deleted: boolean
      rentalId: string | null
    }
  | { type: 'building'; id: string; code: string; name: string | null }
  | {
      type: 'parking-space'
      id: string
      rentalId: string
      code: string
      name: string | null
      property: { name: string | null; code: string }
    }

interface SearchResultsTableProps {
  results: SearchResult[]
}

export const SearchResultsTable = ({ results }: SearchResultsTableProps) => {
  const hasResidences = results.some((r) => r.type === 'residence')
  const hasProperties = results.some((r) => r.type === 'property')

  const getTypeDisplay = (type: string) => {
    switch (type) {
      case 'property':
        return 'Fastighet'
      case 'building':
        return 'Byggnad'
      case 'residence':
        return 'Lägenhet'
      case 'parking-space':
        return 'Parkering'
      default:
        return type
    }
  }

  const getTypeColorClass = (type: string) => {
    switch (type) {
      case 'property':
        return 'bg-blue-100 text-blue-800'
      case 'building':
        return 'bg-purple-100 text-purple-800'
      case 'residence':
        return 'bg-green-100 text-green-800'
      case 'parking-space':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-slate-100'
    }
  }

  const getPath = (result: SearchResult) => {
    switch (result.type) {
      case 'property':
        return `/properties/${result.id}`
      case 'building':
        return `/buildings/${result.id}`
      case 'residence':
        return `/residences/${result.id}`
      case 'parking-space':
        return `/parking-spaces/${result.rentalId}`
      default:
        return '#'
    }
  }

  const getName = (result: SearchResult) => {
    switch (result.type) {
      case 'property':
        return result.designation
      case 'building':
        return result.name || result.code
      case 'residence':
        return result.name || result.code
      case 'parking-space':
        return result.name || result.code
      default:
        return ''
    }
  }

  const getSecondaryInfo = (result: SearchResult) => {
    switch (result.type) {
      case 'property':
        return result.municipality
      case 'building':
        return result.code
      case 'residence':
        return result.rentalId || '-'
      case 'parking-space':
        return result.rentalId
      default:
        return ''
    }
  }

  return (
    <ResponsiveTable
      data={results}
      columns={[
        {
          key: 'name',
          label: 'Namn',
          render: (result) => (
            <span className="font-medium">{getName(result)}</span>
          ),
        },
        {
          key: 'type',
          label: 'Typ',
          render: (result) => (
            <Badge variant="outline" className={getTypeColorClass(result.type)}>
              {getTypeDisplay(result.type)}
            </Badge>
          ),
        },
        {
          key: 'info',
          label: hasResidences && !hasProperties ? 'Hyres ID' : 'Information',
          render: (result) => getSecondaryInfo(result),
          hideOnMobile: true,
        },
        {
          key: 'status',
          label: 'Status',
          render: (result) => (
            <>
              {result.type === 'residence' && (
                <Badge
                  variant="outline"
                  className={
                    result.deleted
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }
                >
                  {result.deleted ? 'Borttagen' : 'Aktiv'}
                </Badge>
              )}
              {result.type !== 'residence' && '-'}
            </>
          ),
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
              {getTypeDisplay(result.type)}
            </Badge>
          </div>
          {result.type === 'residence' && (
            <Badge
              variant="outline"
              className={
                result.deleted
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }
            >
              {result.deleted ? 'Borttagen' : 'Aktiv'}
            </Badge>
          )}
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
