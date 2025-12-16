import { History } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/v2/Badge'
import { DataTable, type Column, type DataTableAction } from './DataTable'
import type { ComponentInstance } from '@/services/types'

interface InstancesTableProps {
  instances: ComponentInstance[]
  isLoading: boolean
  onEdit: (instance: ComponentInstance) => void
  onDelete: (instance: ComponentInstance) => void
  onViewHistory: (instance: ComponentInstance) => void
}

export const InstancesTable = ({
  instances,
  isLoading,
  onEdit,
  onDelete,
  onViewHistory,
}: InstancesTableProps) => {
  const navigate = useNavigate()

  const handleNavigateToRoom = (
    residenceId: string | null | undefined,
    roomId: string | null | undefined
  ) => {
    if (residenceId && roomId) {
      navigate(`/residences/${residenceId}/rooms/${roomId}`)
    }
  }

  const getStatusVariant = (
    status: string
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status) {
      case 'ACTIVE':
        return 'default'
      case 'INACTIVE':
        return 'secondary'
      case 'MAINTENANCE':
        return 'outline'
      case 'DECOMMISSIONED':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'Aktiv'
      case 'INACTIVE':
        return 'Inaktiv'
      case 'MAINTENANCE':
        return 'Underhåll'
      case 'DECOMMISSIONED':
        return 'Ur drift'
      default:
        return status
    }
  }

  const columns: Column<ComponentInstance>[] = [
    {
      key: 'serialNumber',
      label: 'Serienummer',
      render: (item) => <div className="font-medium">{item.serialNumber}</div>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item) => (
        <Badge variant={getStatusVariant(item.status)}>
          {getStatusLabel(item.status)}
        </Badge>
      ),
    },
    {
      key: 'quantity',
      label: 'Antal',
      render: (item) => item.quantity,
    },
    {
      key: 'priceAtPurchase',
      label: 'Inköpspris',
      render: (item) => `${item.priceAtPurchase} kr`,
    },
    {
      key: 'warrantyStartDate',
      label: 'Garantistart',
      render: (item) => (
        <span className="text-muted-foreground">
          {item.warrantyStartDate
            ? new Date(item.warrantyStartDate).toLocaleDateString('sv-SE')
            : '-'}
        </span>
      ),
    },
    {
      key: 'installed',
      label: 'Installerad',
      render: (item) => {
        const hasActiveInstallation = item.componentInstallations?.some(
          (install) => !install.deinstallationDate
        )
        return (
          <Badge variant={hasActiveInstallation ? 'default' : 'secondary'}>
            {hasActiveInstallation ? 'Ja' : 'Nej'}
          </Badge>
        )
      },
    },
    {
      key: 'location',
      label: 'Plats',
      render: (item) => {
        const activeInstallation = item.componentInstallations?.find(
          (install) => !install.deinstallationDate
        )

        if (!activeInstallation) {
          return <span className="text-muted-foreground">Ej installerad</span>
        }

        const structure = activeInstallation.propertyObject?.propertyStructures?.[0]

        if (!structure) {
          return <span className="text-muted-foreground">-</span>
        }

        const displayText = `${structure.residenceCode} / ${structure.roomName || structure.roomCode || 'Okänd'}`
        const tooltipText = `${structure.residenceName || ''}\nLägenhet: ${structure.rentalId || ''}`

        return (
          <button
            onClick={() =>
              handleNavigateToRoom(structure.residenceId, structure.roomId)
            }
            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            title={tooltipText}
          >
            {displayText}
          </button>
        )
      },
    },
  ]

  const actions: DataTableAction<ComponentInstance>[] = [
    {
      label: 'Visa historik',
      onClick: onViewHistory,
      icon: <History className="h-4 w-4 mr-2" />,
    },
  ]

  return (
    <DataTable
      data={instances}
      columns={columns}
      isLoading={isLoading}
      onEdit={onEdit}
      onDelete={onDelete}
      actions={actions}
      emptyMessage="Inga komponenter ännu"
    />
  )
}
