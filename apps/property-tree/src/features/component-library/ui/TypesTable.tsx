import type { ComponentType } from '@/services/types'

import { type Column, DataTable } from '@/shared/ui/DataTable'

interface TypesTableProps {
  types: ComponentType[]
  isLoading: boolean
  onEdit: (type: ComponentType) => void
  onDelete: (type: ComponentType) => void
  onNavigate: (type: ComponentType) => void
}

export const TypesTable = ({
  types,
  isLoading,
  onEdit,
  onDelete,
  onNavigate,
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
      render: (item) => (
        <span className="text-muted-foreground">{item.description || '-'}</span>
      ),
    },
  ]

  return (
    <DataTable
      data={types}
      columns={columns}
      isLoading={isLoading}
      onEdit={onEdit}
      onDelete={onDelete}
      onRowClick={onNavigate}
      emptyMessage="Inga typer ännu"
    />
  )
}
