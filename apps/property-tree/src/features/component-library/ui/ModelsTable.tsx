import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'

import type { ComponentModel } from '@/services/types'

import { sortModelsByName } from '@/shared/lib/componentLabels'
import { Button } from '@/shared/ui/Button'
import { type Column, DataTable } from '@/shared/ui/DataTable'

import { ComponentModelDocuments } from './ComponentModelDocuments'

interface ModelsTableProps {
  models: ComponentModel[]
  isLoading: boolean
  onEdit: (model: ComponentModel) => void
  onDelete: (model: ComponentModel) => void
  onNavigate: (model: ComponentModel) => void
  onCreateInstance: (model: ComponentModel) => void
  getHref: (model: ComponentModel) => string
}

export const ModelsTable = ({
  models,
  isLoading,
  onEdit,
  onDelete,
  onNavigate,
  getHref,
}: ModelsTableProps) => {
  const [documentsModelId, setDocumentsModelId] = useState<string | null>(null)

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
        <span
          className={
            !item.manufacturer || item.manufacturer === 'Unknown'
              ? 'text-muted-foreground'
              : ''
          }
        >
          {item.manufacturer && item.manufacturer !== 'Unknown'
            ? item.manufacturer
            : '-'}
        </span>
      ),
    },
    {
      key: 'currentPrice',
      label: 'Pris',
      isEmpty: (item) => !item.currentPrice,
      render: (item) => (
        <span className={!item.currentPrice ? 'text-muted-foreground' : ''}>
          {item.currentPrice
            ? item.currentPrice.toLocaleString('sv-SE', {
                style: 'currency',
                currency: 'SEK',
                maximumFractionDigits: 0,
              })
            : '-'}
        </span>
      ),
    },
    {
      key: 'currentInstallPrice',
      label: 'Installationspris',
      isEmpty: (item) => !item.currentInstallPrice,
      render: (item) => (
        <span
          className={!item.currentInstallPrice ? 'text-muted-foreground' : ''}
        >
          {item.currentInstallPrice
            ? item.currentInstallPrice.toLocaleString('sv-SE', {
                style: 'currency',
                currency: 'SEK',
                maximumFractionDigits: 0,
              })
            : '-'}
        </span>
      ),
    },
    {
      key: 'warrantyMonths',
      label: 'Garanti',
      isEmpty: (item) => !item.warrantyMonths,
      render: (item) => (
        <span className={!item.warrantyMonths ? 'text-muted-foreground' : ''}>
          {item.warrantyMonths ? `${item.warrantyMonths} mån` : '-'}
        </span>
      ),
    },
    {
      key: 'dimensions',
      label: 'Dimensioner',
      isEmpty: (item) => !item.dimensions,
      render: (item) => (
        <span className="text-muted-foreground">{item.dimensions || '-'}</span>
      ),
    },
    {
      key: 'coclassCode',
      label: 'CoClass',
      isEmpty: (item) => !item.coclassCode,
      render: (item) => (
        <span className="text-muted-foreground">{item.coclassCode || '-'}</span>
      ),
    },
    {
      key: 'components',
      label: 'Komponenter',
      render: (item) => (
        <Link
          to={getHref(item)}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
        >
          Visa komponenter
        </Link>
      ),
    },
    {
      key: 'documents',
      label: 'Dok.',
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation()
            setDocumentsModelId(item.id)
          }}
          title="Visa dokument"
          aria-label={`Visa dokument för ${item.modelName}`}
        >
          <FileText className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  // Expandable content for technical specification and installation instructions
  const expandableContent = (model: ComponentModel) => {
    const hasTechSpec =
      model.technicalSpecification && model.technicalSpecification.trim()
    const hasInstallInstructions =
      model.installationInstructions && model.installationInstructions.trim()

    if (!hasTechSpec && !hasInstallInstructions) {
      return null
    }

    return (
      <div className="space-y-4">
        {hasTechSpec && (
          <div>
            <h4 className="text-sm font-medium mb-1">Teknisk specifikation</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {model.technicalSpecification}
            </p>
          </div>
        )}
        {hasInstallInstructions && (
          <div>
            <h4 className="text-sm font-medium mb-1">
              Installationsinstruktioner
            </h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {model.installationInstructions}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <DataTable
        data={sortModelsByName(models)}
        columns={columns}
        isLoading={isLoading}
        onEdit={onEdit}
        onDelete={onDelete}
        onRowClick={onNavigate}
        getRowHref={getHref}
        pageSize={50}
        emptyMessage="Inga modeller"
        getRowLabel={(item) => item.modelName}
        expandableContent={expandableContent}
      />

      {documentsModelId && (
        <ComponentModelDocuments
          modelId={documentsModelId}
          isOpen={true}
          onClose={() => setDocumentsModelId(null)}
        />
      )}
    </>
  )
}
