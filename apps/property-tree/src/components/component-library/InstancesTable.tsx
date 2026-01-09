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

  const formatCurrency = (value: number) =>
    value.toLocaleString('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      maximumFractionDigits: 0,
    })

  const handleNavigateToResidence = (
    residenceId: string | null | undefined,
    roomCode: string | null | undefined
  ) => {
    if (residenceId) {
      const url = roomCode
        ? `/residences/${residenceId}?room=${roomCode}`
        : `/residences/${residenceId}`
      navigate(url)
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

  const getConditionLabel = (condition: string | null | undefined): string => {
    switch (condition) {
      case 'NEW':
        return 'Nyskick'
      case 'GOOD':
        return 'Gott skick'
      case 'FAIR':
        return 'Godtagbart skick'
      case 'POOR':
        return 'Dåligt skick'
      case 'DAMAGED':
        return 'Skadat'
      default:
        return '-'
    }
  }

  const getConditionVariant = (
    condition: string | null | undefined
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (condition) {
      case 'NEW':
        return 'default'
      case 'GOOD':
        return 'default'
      case 'FAIR':
        return 'secondary'
      case 'POOR':
        return 'outline'
      case 'DAMAGED':
        return 'destructive'
      default:
        return 'secondary'
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
      key: 'condition',
      label: 'Skick',
      render: (item) => (
        <Badge variant={getConditionVariant(item.condition)}>
          {getConditionLabel(item.condition)}
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
      render: (item) => formatCurrency(item.priceAtPurchase),
    },
    {
      key: 'warrantyMonths',
      label: 'Garantitid',
      render: (item) => `${item.warrantyMonths} mån`,
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
      key: 'economicLifespan',
      label: 'Ekon. livslängd',
      render: (item) => `${item.economicLifespan} år`,
    },
    {
      key: 'ncsCode',
      label: 'NCS-kod',
      render: (item) => (
        <span className="text-muted-foreground">{item.ncsCode || '-'}</span>
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

        const structure =
          activeInstallation.propertyObject?.propertyStructures?.[0]

        if (!structure) {
          return <span className="text-muted-foreground">-</span>
        }

        // Use residence.id from propertyStructure for navigation (Residence.id / keybalgh)
        // NOT structure.residenceId which is actually Residence.propertyObjectId (keycmobj)
        const residenceId = structure.residence?.id

        const displayText = `${structure.residenceCode} / ${structure.roomName || structure.roomCode || 'Okänd'}`
        const tooltipText = `${structure.residenceName || ''}\nLägenhet: ${structure.rentalId || ''}`

        if (!residenceId) {
          // Fallback: show location but not clickable if residence.id is missing
          return (
            <span className="text-muted-foreground" title={tooltipText}>
              {displayText}
            </span>
          )
        }

        return (
          <button
            onClick={() =>
              handleNavigateToResidence(residenceId, structure.roomCode)
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

  // Expandable content for additional information
  const expandableContent = (instance: ComponentInstance) => {
    const hasAdditionalInfo =
      instance.additionalInformation && instance.additionalInformation.trim()
    const hasSpecifications =
      instance.specifications && instance.specifications.trim()

    if (!hasAdditionalInfo && !hasSpecifications) {
      return null
    }

    return (
      <div className="space-y-4">
        {hasSpecifications && (
          <div>
            <h4 className="text-sm font-medium mb-1">Specifikationer</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {instance.specifications}
            </p>
          </div>
        )}
        {hasAdditionalInfo && (
          <div>
            <h4 className="text-sm font-medium mb-1">
              Ytterligare information
            </h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {instance.additionalInformation}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <DataTable
      data={instances}
      columns={columns}
      isLoading={isLoading}
      onEdit={onEdit}
      onDelete={onDelete}
      actions={actions}
      emptyMessage="Inga komponenter ännu"
      expandableContent={expandableContent}
    />
  )
}
