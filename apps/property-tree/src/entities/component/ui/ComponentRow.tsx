import { type ReactNode, useState } from 'react'
import { AlertTriangle, ChevronDown, FileText, Images } from 'lucide-react'

import type { Component } from '@/services/types'

import { formatISODate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/Collapsible'
import { CopyableField } from '@/shared/ui/CopyableField'

import {
  calculateComponentAge,
  calculateComponentLifespanProgress,
  calculateComponentWarrantyStatus,
  formatComponentCurrency,
  getComponentStatusConfig,
  isKnownInstallationDate,
  knownLifespan,
} from '../lib/componentCalculations'

interface ComponentRowProps {
  component: Component
  onShowImages?: () => void
  onShowDocuments?: () => void
  actions?: ReactNode
}

const STATUS_BADGE_CLASSES = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-muted text-muted-foreground',
} as const

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="font-medium">{value}</p>
  </div>
)

export const ComponentRow = ({
  component,
  onShowImages,
  onShowDocuments,
  actions,
}: ComponentRowProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const installationDate =
    component.componentInstallations?.[0]?.installationDate
  const hasKnownInstallation = isKnownInstallationDate(installationDate)
  const age = calculateComponentAge(installationDate)
  const warranty = calculateComponentWarrantyStatus(component)
  const lifespan = calculateComponentLifespanProgress(component)
  const technicalLifespan = knownLifespan(component.subtype?.technicalLifespan)
  const economicLifespan = knownLifespan(component.subtype?.economicLifespan)
  const status = getComponentStatusConfig(component.status)
  const isPastLifespan = lifespan !== null && lifespan.percentage >= 100

  const typeName = component.subtype?.componentType?.description
  const subtypeName = component.subtype?.subTypeName
  const title = [typeName, subtypeName].filter(Boolean).join(' › ') || '-'

  const manufacturer =
    component.model?.manufacturer && component.model.manufacturer !== 'Unknown'
      ? component.model.manufacturer
      : null
  const modelName = [manufacturer, component.model?.modelName]
    .filter(Boolean)
    .join(' ')

  const warrantyText =
    warranty.state === 'active'
      ? `Garanti t.o.m. ${formatISODate(warranty.expiryDate?.toISOString())}`
      : warranty.state === 'expired'
        ? 'Garanti utgången'
        : null

  const summary = [
    modelName || null,
    hasKnownInstallation
      ? `Installerad ${new Date(installationDate).getFullYear()}`
      : 'Installationsår okänt',
    warrantyText,
  ].filter(Boolean)

  const price = component.priceAtPurchase ? component.priceAtPurchase : null

  const facts: { label: string; value: string | null }[] = [
    { label: 'Modell', value: modelName || null },
    { label: 'Status', value: status.label },
    {
      label: 'Installerad',
      value: hasKnownInstallation ? formatISODate(installationDate) : null,
    },
    { label: 'Ålder', value: age === null ? null : `${age} år` },
    {
      label: 'Garanti',
      value:
        warranty.state === 'active'
          ? `T.o.m. ${formatISODate(warranty.expiryDate?.toISOString())} (${warranty.remaining})`
          : warranty.state === 'expired'
            ? `Utgången ${formatISODate(warranty.expiryDate?.toISOString())}`
            : null,
    },
    {
      label: 'Teknisk livslängd',
      value:
        technicalLifespan === null
          ? null
          : lifespan
            ? `${technicalLifespan} år (${lifespan.remaining} år kvar)`
            : `${technicalLifespan} år`,
    },
    {
      label: 'Ekonomisk livslängd',
      value: economicLifespan === null ? null : `${economicLifespan} år`,
    },
    {
      label: 'A-pris',
      value: price === null ? null : formatComponentCurrency(price),
    },
    {
      label: 'Specifikationer',
      value: component.model?.technicalSpecification || null,
    },
    {
      label: 'Dokumentation',
      value: component.model?.installationInstructions || null,
    },
  ]
  const missing = [
    !modelName && 'modell',
    !component.serialNumber && 'serienummer',
    !hasKnownInstallation && 'installationsdatum',
    warranty.state === 'unknown' && 'garanti',
    technicalLifespan === null && 'teknisk livslängd',
    economicLifespan === null && 'ekonomisk livslängd',
  ].filter(Boolean)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="group flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{summary.join(' · ')}</p>
          {isPastLifespan && (
            <p className="mt-1 flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              Över teknisk livslängd
            </p>
          )}
        </div>
        {status.color !== 'green' && status.label !== '-' && (
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 border-transparent px-2.5',
              STATUS_BADGE_CLASSES[status.color]
            )}
          >
            {status.label}
          </Badge>
        )}
        <ChevronDown
          className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-1 lg:grid-cols-3">
          {facts.map(
            ({ label, value }) =>
              value && <Field key={label} label={label} value={value} />
          )}
          {component.serialNumber && (
            <CopyableField label="Serienummer" value={component.serialNumber} />
          )}
          {component.model?.coclassCode && (
            <CopyableField
              label="CoClass-kod"
              value={component.model.coclassCode}
            />
          )}
          {component.ncsCode && (
            <CopyableField label="NCS-kod" value={component.ncsCode} />
          )}
          {component.model?.dimensions && (
            <CopyableField label="Mått" value={component.model.dimensions} />
          )}
        </div>

        {missing.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Uppgifter saknas: {missing.join(', ')}
          </p>
        )}

        {(onShowImages ||
          (onShowDocuments && component.model?.id) ||
          actions) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {onShowImages && (
              <Button variant="outline" size="sm" onClick={onShowImages}>
                <Images />
                Bilder
              </Button>
            )}
            {onShowDocuments && component.model?.id && (
              <Button variant="outline" size="sm" onClick={onShowDocuments}>
                <FileText />
                Dokument
              </Button>
            )}
            {actions}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
