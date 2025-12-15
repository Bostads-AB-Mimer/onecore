import { Badge } from '@/components/ui/v2/Badge'
import { DataTable, type Column } from './DataTable'
import type { ComponentSubtype } from '@/services/types'

interface SubtypesTableProps {
  subtypes: ComponentSubtype[]
  isLoading: boolean
  onEdit: (subtype: ComponentSubtype) => void
  onDelete: (subtype: ComponentSubtype) => void
  onNavigate: (subtype: ComponentSubtype) => void
}

export const SubtypesTable = ({
  subtypes,
  isLoading,
  onEdit,
  onDelete,
  onNavigate,
}: SubtypesTableProps) => {
  const columns: Column<ComponentSubtype>[] = [
    {
      key: 'name',
      label: 'Namn',
      render: (item) => <div className="font-medium">{item.subTypeName}</div>,
    },
    {
      key: 'xpandCode',
      label: 'Xpand-kod',
      render: (item) => (
        <span className="text-muted-foreground">{item.xpandCode || '-'}</span>
      ),
    },
    {
      key: 'technicalLifespan',
      label: 'Teknisk livslängd',
      render: (item) => `${item.technicalLifespan} år`,
    },
    {
      key: 'economicLifespan',
      label: 'Ekonomisk livslängd',
      render: (item) => `${item.economicLifespan} år`,
    },
    {
      key: 'quantityType',
      label: 'Kvantitetstyp',
      render: (item) => (
        <Badge variant="outline">
          {item.quantityType === 'UNIT'
            ? 'Styck'
            : item.quantityType === 'METER'
              ? 'Meter'
              : item.quantityType === 'SQUARE_METER'
                ? 'Kvm'
                : 'Kbm'}
        </Badge>
      ),
    },
  ]

  return (
    <DataTable
      data={subtypes}
      columns={columns}
      isLoading={isLoading}
      onEdit={onEdit}
      onDelete={onDelete}
      onRowClick={onNavigate}
      emptyMessage="Inga undertyper ännu"
    />
  )
}
