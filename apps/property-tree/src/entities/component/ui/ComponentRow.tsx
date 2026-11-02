import { type ReactNode, useState } from 'react'
import { AlertTriangle, ChevronDown, FileText, Images } from 'lucide-react'

import type { Component } from '@/services/types'

import { formatComponentModelName } from '@/shared/lib/componentLabels'
import { formatISODate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { badgeVariants } from '@/shared/ui/Badge'
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
  componentEconomicLifespan,
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
  green: 'bg-success/15 text-success',
  yellow: 'bg-warning/15 text-warning',
  red: 'bg-destructive/15 text-destructive',
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
  const economicLifespan = componentEconomicLifespan(component)
  const status = getComponentStatusConfig(component.status)
  const isPastLifespan = lifespan !== null && lifespan.percentage >= 100
  const isSurface =
    component.subtype?.componentType?.category?.type === 'SURFACE'

  const typeName = component.subtype?.componentType?.typeName
  const subtypeName = component.subtype?.subTypeName
  const title = [typeName, subtypeName].filter(Boolean).join(' › ') || '-'

  const modelName = formatComponentModelName(component.model)

  const warrantyText =
    warranty.state === 'active'
      ? `Garanti t.o.m. ${formatISODate(warranty.expiryDate?.toISOString())}`
      : warranty.state === 'expired'
        ? 'Garanti utgången'
        : null

  const summary = [
    modelName || null,
    hasKnownInstallation
      ? `Installerad ${new Date(installationDate).getUTCFullYear()}`
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
      value: isSurface
        ? component.specifications || null
        : component.model?.technicalSpecification || null,
    },
    {
      label: 'Dokumentation',
      value: component.model?.installationInstructions || null,
    },
  ]
  const missing = [
    !isSurface && !modelName && 'modell',
    !isSurface && !component.serialNumber && 'serienummer',
    !hasKnownInstallation && 'installationsdatum',
    !isSurface && warranty.state === 'unknown' && 'garanti',
    technicalLifespan === null && 'teknisk livslängd',
    economicLifespan === null && 'ekonomisk livslängd',
  ].filter(Boolean)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="group flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          <span className="block text-sm text-muted-foreground">
            {summary.join(' · ')}
          </span>
          {isPastLifespan && (
            <span className="mt-1 flex items-center gap-1 text-sm text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              Över teknisk livslängd
            </span>
          )}
        </span>
        {status.color !== 'green' && status.label !== '-' && (
          <span
            className={cn(
              badgeVariants({ variant: 'outline' }),
              'shrink-0 border-transparent px-2.5',
              STATUS_BADGE_CLASSES[status.color]
            )}
          >
            {status.label}
          </span>
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
