import { History, Unplug, ImageIcon } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import {
  DataTable,
  type Column,
  type DataTableAction,
} from '@/shared/ui/DataTable'
import type { Component } from '@/services/types'
import { formatISODate } from '@/shared/lib/formatters'

interface InstancesTableProps {
  instances: Component[]
  isLoading: boolean
  onEdit: (instance: Component) => void
  onDelete: (instance: Component) => void
  onViewHistory: (instance: Component) => void
  onUninstall: (instance: Component) => void
  onViewImages: (instance: Component) => void
}

export const InstancesTable = ({
  instances,
  isLoading,
  onEdit,
  onDelete,
  onViewHistory,
  onUninstall,
  onViewImages,
}: InstancesTableProps) => {
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
      window.open(url, '_blank')
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

  const columns: Column<Component>[] = [
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
      render: (item) => (
        <span className={!item.quantity ? 'text-muted-foreground' : ''}>
          {item.quantity || '-'}
        </span>
      ),
    },
    {
      key: 'priceAtPurchase',
      label: 'Inköpspris',
      render: (item) => (
        <span className={!item.priceAtPurchase ? 'text-muted-foreground' : ''}>
          {item.priceAtPurchase ? formatCurrency(item.priceAtPurchase) : '-'}
        </span>
      ),
    },
    {
      key: 'warrantyMonths',
      label: 'Garantitid',
      render: (item) => (
        <span className={!item.warrantyMonths ? 'text-muted-foreground' : ''}>
          {item.warrantyMonths ? `${item.warrantyMonths} mån` : '-'}
        </span>
      ),
    },
    {
      key: 'warrantyStartDate',
      label: 'Garantistart',
      render: (item) => (
        <span className="text-muted-foreground">
          {formatISODate(item.warrantyStartDate)}
        </span>
      ),
    },
    {
      key: 'economicLifespan',
      label: 'Ekon. livslängd',
      render: (item) => (
        <span className={!item.economicLifespan ? 'text-muted-foreground' : ''}>
          {item.economicLifespan ? `${item.economicLifespan} år` : '-'}
        </span>
      ),
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
    {
      key: 'images',
      label: 'Bilder',
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation()
            onViewImages(item)
          }}
          title="Visa bilder"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  const hasActiveInstallation = (item: Component) =>
    item.componentInstallations?.some((install) => !install.deinstallationDate)

  const actions: DataTableAction<Component>[] = [
    {
      label: 'Visa historik',
      onClick: onViewHistory,
      icon: <History className="h-4 w-4 mr-2" />,
    },
    {
      label: 'Avinstallera',
      onClick: (item) => {
        if (hasActiveInstallation(item)) {
          onUninstall(item)
        }
      },
      icon: <Unplug className="h-4 w-4 mr-2" />,
    },
  ]

  // Expandable content for additional information
  const expandableContent = (instance: Component) => {
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
