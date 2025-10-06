import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/v2/Badge'
import { Button } from '@/components/ui/v2/Button'
import { ResponsiveTable } from '@/components/shared/v2/ResponsiveTable'
import type { Property } from '@/services/types'

interface PropertiesTableProps {
  properties: Property[]
}

export const PropertiesTable = ({ properties }: PropertiesTableProps) => {
  const columns = [
    {
      key: 'designation',
      label: 'Beteckning',
      render: (property: Property) => (
        <span className="font-medium">{property.designation}</span>
      ),
    },
    {
      key: 'code',
      label: 'Kod',
      render: (property: Property) => property.code,
      hideOnMobile: true,
    },
    {
      key: 'municipality',
      label: 'Kommun',
      render: (property: Property) => property.municipality,
    },
    {
      key: 'tract',
      label: 'Trakt',
      render: (property: Property) => property.tract,
      hideOnMobile: true,
    },
    {
      key: 'actions',
      label: 'Åtgärd',
      render: (property: Property) => (
        <Button asChild variant="link" size="sm">
          <Link to={`/properties/${property.id}`}>Visa detaljer</Link>
        </Button>
      ),
      className: 'text-right',
    },
  ]

  const mobileCardRenderer = (property: Property) => (
    <div className="space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-sm">{property.designation}</h3>
          <p className="text-xs text-muted-foreground">{property.municipality}</p>
        </div>
        <Badge variant="outline" className="bg-slate-100 text-xs">
          {property.code}
        </Badge>
      </div>
      <div className="flex justify-end items-center pt-1">
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link to={`/properties/${property.id}`}>Visa detaljer</Link>
        </Button>
      </div>
    </div>
  )

  return (
    <ResponsiveTable
      data={properties}
      columns={columns}
      keyExtractor={(property) => property.id}
      emptyMessage="Inga fastigheter hittades med angivna sökkriterier"
      mobileCardRenderer={mobileCardRenderer}
    />
  )
}
