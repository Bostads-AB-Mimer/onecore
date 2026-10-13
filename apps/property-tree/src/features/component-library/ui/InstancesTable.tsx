import { History, ImageIcon, Unplug } from 'lucide-react'

import type { Component } from '@/services/types'

import { formatComponentModelName } from '@/shared/lib/componentLabels'
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
  formatInstallationDate,
  getComponentColumnKeys,
  getComponentLocation,
  getInstallationDate,
} from '../lib/componentRows'

interface InstancesTableProps {
  instances: Component[]
  categoryType: CategoryType
  isLoading: boolean
  pageSize: number
  /** The list is filtered to one model, so the Modell column says nothing. */
  hideModel?: boolean
  onEdit: (instance: Component) => void
  onDelete: (instance: Component) => void
  onViewHistory: (instance: Component) => void
  onUninstall: (instance: Component) => void
  onViewImages: (instance: Component) => void
}

const residenceUrl = (rentalId: string, roomCode: string | null) =>
  roomCode
    ? `${paths.residence(rentalId)}?room=${encodeURIComponent(roomCode)}`
    : paths.residence(rentalId)

const muted = (text: string) => (
  <span className="text-muted-foreground">{text}</span>
)

const rowLabel = (item: Component) => {
  const { address, detail } = getComponentLocation(item)
  return address ? `${address}, ${detail}` : detail
}

const COLUMNS: Record<ComponentColumnKey, Column<Component>> = {
  location: {
    key: 'location',
    label: 'Plats',
    width: '28%',
    render: (item) => {
      const { address, detail, rentalId, roomCode } = getComponentLocation(item)
      if (!rentalId) {
        return (
          <span className="flex flex-col leading-snug">
            {address && <span className="font-medium">{address}</span>}
            <span className="text-muted-foreground">{detail}</span>
          </span>
        )
      }
      return (
        <a
          href={residenceUrl(rentalId, roomCode)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="group flex flex-col leading-snug rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-medium text-primary underline-offset-4 group-hover:underline">
            {address ?? detail}
          </span>
          {address && <span className="text-muted-foreground">{detail}</span>}
          <span className="sr-only">(öppnas i ny flik)</span>
        </a>
      )
    },
  },
  model: {
    key: 'model',
    label: 'Modell',
    isEmpty: (item) => !formatComponentModelName(item.model),
    keepWhenEmpty: true,
    render: (item) => formatComponentModelName(item.model) || muted('-'),
  },
  installed: {
    key: 'installed',
    label: 'Installerad',
    width: '8.5rem',
    className: 'whitespace-nowrap tabular-nums',
    render: (item) => muted(formatInstallationDate(getInstallationDate(item))),
  },
  serialNumber: {
    key: 'serialNumber',
    label: 'Serienr',
    width: '22%',
    className: 'tabular-nums',
    isEmpty: (item) => !item.serialNumber,
    keepWhenEmpty: true,
    render: (item) => item.serialNumber || muted('-'),
  },
  specifications: {
    key: 'specifications',
    label: 'Specifikation',
    isEmpty: (item) => !item.specifications,
    keepWhenEmpty: true,
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
    width: '8rem',
    className: 'whitespace-nowrap tabular-nums',
    render: (item) => formatComponentQuantity(item),
  },
}

const hasActiveInstallation = (item: Component) =>
  activeInstallation(item) !== undefined

export const InstancesTable = ({
  instances,
  categoryType,
  isLoading,
  pageSize,
  hideModel = false,
  onEdit,
  onDelete,
  onViewHistory,
  onUninstall,
  onViewImages,
}: InstancesTableProps) => {
  const columns = getComponentColumnKeys(categoryType)
    .filter((key) => !(hideModel && key === 'model'))
    .map((key) => COLUMNS[key])

  const actions: DataTableAction<Component>[] = [
    {
      label: 'Visa detaljer',
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
      onClick: onUninstall,
      isHidden: (item) => !hasActiveInstallation(item),
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
      onRowClick={onViewHistory}
      actions={actions}
      emptyMessage="Inga komponenter"
      pageSize={pageSize}
      getRowLabel={rowLabel}
      deleteBlockedReason={(item) =>
        hasActiveInstallation(item)
          ? 'Avinstallera komponenten först'
          : undefined
      }
    />
  )
}
