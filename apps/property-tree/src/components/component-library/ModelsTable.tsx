import { useState } from 'react'
import { Eye, FileText } from 'lucide-react'
import { Button } from '@/components/ui/v2/Button'
import { DataTable, type Column, type DataTableAction } from './DataTable'
import { ComponentModelDocuments } from './dialogs/ComponentModelDocuments'
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
        <span className="text-muted-foreground">{item.manufacturer}</span>
      ),
    },
    {
      key: 'currentPrice',
      label: 'Pris',
      render: (item) =>
        item.currentPrice.toLocaleString('sv-SE', {
          style: 'currency',
          currency: 'SEK',
          maximumFractionDigits: 0,
        }),
    },
    {
      key: 'currentInstallPrice',
      label: 'Installationspris',
      render: (item) =>
        item.currentInstallPrice.toLocaleString('sv-SE', {
          style: 'currency',
          currency: 'SEK',
          maximumFractionDigits: 0,
        }),
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
    {
      key: 'coclassCode',
      label: 'CoClass',
      render: (item) => (
        <span className="text-muted-foreground">{item.coclassCode || '-'}</span>
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
        >
          <FileText className="h-4 w-4" />
        </Button>
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

  // Expandable content for technical specification and installation instructions
  const expandableContent = (model: ComponentModel) => {
    const hasTechSpec = model.technicalSpecification && model.technicalSpecification.trim()
    const hasInstallInstructions = model.installationInstructions && model.installationInstructions.trim()

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
            <h4 className="text-sm font-medium mb-1">Installationsinstruktioner</h4>
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
        data={models}
        columns={columns}
        isLoading={isLoading}
        onEdit={onEdit}
        onDelete={onDelete}
        onRowClick={onNavigate}
        actions={actions}
        emptyMessage="Inga modeller ännu"
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
