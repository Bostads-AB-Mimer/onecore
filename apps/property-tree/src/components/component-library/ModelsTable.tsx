import { Eye } from 'lucide-react'
import { DataTable, type Column, type DataTableAction } from './DataTable'
import type { ComponentModel } from '@/services/types'

interface ModelsTableProps {
  models: ComponentModel[]
  isLoading: boolean
  onEdit: (model: ComponentModel) => void
  onDelete: (model: ComponentModel) => void
  onNavigate: (model: ComponentModel) => void
  onCreateInstance: (model: ComponentModel) => void
}

export const ModelsTable = ({
  models,
  isLoading,
  onEdit,
  onDelete,
  onNavigate,
  onCreateInstance,
}: ModelsTableProps) => {
  const columns: Column<ComponentModel>[] = [
    {
      key: 'modelName',
      label: 'Modellnamn',
      render: (item) => <div className="font-medium">{item.modelName}</div>,
    },
    {
      key: 'manufacturer',
      label: 'Tillverkare',
      render: (item) => (
        <span className="text-muted-foreground">{item.manufacturer}</span>
      ),
    },
    {
      key: 'currentPrice',
      label: 'Pris',
      render: (item) => `${item.currentPrice} kr`,
    },
    {
      key: 'warrantyMonths',
      label: 'Garanti',
      render: (item) => `${item.warrantyMonths} mån`,
    },
    {
      key: 'dimensions',
      label: 'Dimensioner',
      render: (item) => (
        <span className="text-muted-foreground">{item.dimensions || '-'}</span>
      ),
    },
  ]

  const actions: DataTableAction<ComponentModel>[] = [
    {
      label: 'Visa instanser',
      onClick: onNavigate,
      icon: <Eye className="h-4 w-4 mr-2" />,
    },
  ]

  return (
    <DataTable
      data={models}
      columns={columns}
      isLoading={isLoading}
      onEdit={onEdit}
      onDelete={onDelete}
      onRowClick={onNavigate}
      actions={actions}
      emptyMessage="Inga modeller ännu"
    />
  )
}
