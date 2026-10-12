import { History, ImageIcon, Unplug } from 'lucide-react'

import type { Component } from '@/services/types'

import { formatComponentModelName } from '@/shared/lib/componentLabels'
import { formatISODate } from '@/shared/lib/formatters'
import { paths } from '@/shared/routes'
import {
  type Column,
  DataTable,
  type DataTableAction,
} from '@/shared/ui/DataTable'

import {
  activeInstallation,
  type CategoryType,
  type ComponentColumnKey,
  formatComponentQuantity,
  getComponentColumnKeys,
  getComponentLocation,
  getInstallationDate,
} from '../lib/componentRows'

interface InstancesTableProps {
  instances: Component[]
  categoryType: CategoryType
  isLoading: boolean
  pageSize: number
  onEdit: (instance: Component) => void
  onDelete: (instance: Component) => void
  onViewHistory: (instance: Component) => void
  onUninstall: (instance: Component) => void
  onViewImages: (instance: Component) => void
}

const openResidence = (rentalId: string, roomCode: string | null) => {
  const url = roomCode
    ? `${paths.residence(rentalId)}?room=${encodeURIComponent(roomCode)}`
    : paths.residence(rentalId)
  window.open(url, '_blank')
}

const muted = (text: string) => (
  <span className="text-muted-foreground">{text}</span>
)

const COLUMNS: Record<ComponentColumnKey, Column<Component>> = {
  location: {
    key: 'location',
    label: 'Plats',
    render: (item) => {
      const location = getComponentLocation(item)
      if (!location.rentalId) {
        return (
          <span className="text-muted-foreground" title={location.tooltip}>
            {location.label}
          </span>
        )
      }
      const { rentalId, roomCode } = location
      return (
        <button
          onClick={(e) => {
            e.stopPropagation()
            openResidence(rentalId, roomCode)
          }}
          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          title={location.tooltip}
        >
          {location.label}
        </button>
      )
    },
  },
  model: {
    key: 'model',
    label: 'Modell',
    render: (item) => formatComponentModelName(item.model) || muted('-'),
  },
  installed: {
    key: 'installed',
    label: 'Installerad',
    render: (item) => muted(formatISODate(getInstallationDate(item))),
  },
  serialNumber: {
    key: 'serialNumber',
    label: 'Serienr',
    render: (item) => item.serialNumber || muted('-'),
  },
  specifications: {
    key: 'specifications',
    label: 'Specifikation',
    render: (item) =>
      item.specifications ? (
        <span className="block max-w-md truncate" title={item.specifications}>
          {item.specifications}
        </span>
      ) : (
        muted('-')
      ),
  },
  quantity: {
    key: 'quantity',
    label: 'Antal',
    render: (item) => formatComponentQuantity(item),
  },
}

const hasActiveInstallation = (item: Component) =>
  activeInstallation(item) !== undefined

const expandableContent = (instance: Component) => {
  const specifications = instance.specifications?.trim()
  const additionalInformation = instance.additionalInformation?.trim()
  if (!specifications && !additionalInformation) return null

  return (
    <div className="space-y-4">
      {specifications && (
        <div>
          <h4 className="text-sm font-medium mb-1">Specifikationer</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {specifications}
          </p>
        </div>
      )}
      {additionalInformation && (
        <div>
          <h4 className="text-sm font-medium mb-1">Ytterligare information</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {additionalInformation}
          </p>
        </div>
      )}
    </div>
  )
}

export const InstancesTable = ({
  instances,
  categoryType,
  isLoading,
  pageSize,
  onEdit,
  onDelete,
  onViewHistory,
  onUninstall,
  onViewImages,
}: InstancesTableProps) => {
  const columns = getComponentColumnKeys(categoryType).map(
    (key) => COLUMNS[key]
  )

  const actions: DataTableAction<Component>[] = [
    {
      label: 'Visa historik',
      onClick: onViewHistory,
      icon: <History className="h-4 w-4 mr-2" />,
    },
    {
      label: 'Visa bilder',
      onClick: onViewImages,
      icon: <ImageIcon className="h-4 w-4 mr-2" />,
    },
    {
      label: 'Avinstallera',
      onClick: (item) => {
        if (hasActiveInstallation(item)) onUninstall(item)
      },
      icon: <Unplug className="h-4 w-4 mr-2" />,
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
      expandableContent={
        categoryType === 'EQUIPMENT' ? expandableContent : undefined
      }
      pageSize={pageSize}
    />
  )
}
