import type { ComponentType } from '@/services/types'

import { sortBySwedishName } from '@/shared/lib/sortByName'
import { type Column, DataTable } from '@/shared/ui/DataTable'

interface TypesTableProps {
  types: ComponentType[]
  isLoading: boolean
  onEdit: (type: ComponentType) => void
  onDelete: (type: ComponentType) => void
  onNavigate: (type: ComponentType) => void
  getHref: (type: ComponentType) => string
}

export const TypesTable = ({
  types,
  isLoading,
  onEdit,
  onDelete,
  onNavigate,
  getHref,
}: TypesTableProps) => {
  const columns: Column<ComponentType>[] = [
    {
      key: 'name',
      label: 'Namn',
      render: (item) => <div className="font-medium">{item.typeName}</div>,
    },
    {
      key: 'description',
      label: 'Beskrivning',
      isEmpty: (item) => !item.description,
      render: (item) => (
        <span className="text-muted-foreground">{item.description || '-'}</span>
      ),
    },
  ]

  return (
    <DataTable
      data={sortBySwedishName(types, (item) => item.typeName)}
      columns={columns}
      isLoading={isLoading}
      onEdit={onEdit}
      onDelete={onDelete}
      onRowClick={onNavigate}
      getRowHref={getHref}
      pageSize={50}
      emptyMessage="Inga typer"
      getRowLabel={(item) => item.typeName}
    />
  )
}
