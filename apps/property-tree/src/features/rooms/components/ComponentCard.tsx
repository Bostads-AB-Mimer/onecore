import { Card, CardContent, CardHeader } from '../../../components/ui/v2/Card'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/v2/Button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../components/ui/Accordion'
import { Copy, Ticket, Images, FileText } from 'lucide-react'
import type { Component } from '@/services/types'
import { useState } from 'react'
import { ComponentImageGallery } from './ComponentImageGallery'
import { ComponentModelDocuments } from './dialogs/ComponentModelDocuments'

interface ComponentCardProps {
  component: Component
}

export const ComponentCard = ({ component }: ComponentCardProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showGallery, setShowGallery] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)

  // Helper: Format dates
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  // Helper: Format currency
  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-'
    return `${value.toLocaleString('sv-SE')} kr`
  }

  // Helper: Calculate age from installation date
  const calculateAge = (installationDate: string | null | undefined) => {
    if (!installationDate) return null
    const installed = new Date(installationDate)
    const now = new Date()
    const years = now.getFullYear() - installed.getFullYear()
    return years >= 0 ? years : 0
  }

  // Helper: Calculate warranty status
  const calculateWarrantyStatus = () => {
    if (!component.warrantyStartDate || !component.warrantyMonths) {
      return { active: false, remaining: '', expiryDate: null }
    }

    const startDate = new Date(component.warrantyStartDate)
    const expiryDate = new Date(startDate)
    expiryDate.setMonth(expiryDate.getMonth() + component.warrantyMonths)

    const now = new Date()
    const active = expiryDate > now

    if (!active) {
      return { active: false, remaining: 'Utgången', expiryDate }
    }

    const monthsRemaining = Math.round(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)
    )
    const yearsRemaining = Math.floor(monthsRemaining / 12)

    let remaining = ''
    if (yearsRemaining >= 1) {
      remaining = `${yearsRemaining} år kvar`
    } else {
      remaining = `${monthsRemaining} mån kvar`
    }

    return { active, remaining, expiryDate }
  }

  // Helper: Map status to Swedish with color
  const getStatusConfig = (status: string | undefined) => {
    if (!status) return { label: '-', color: 'gray' }

    const statusMap: Record<
      string,
      { label: string; color: 'green' | 'yellow' | 'red' | 'gray' }
    > = {
      ACTIVE: { label: 'Aktiv', color: 'green' },
      MAINTENANCE: { label: 'Underhåll', color: 'yellow' },
      DECOMMISSIONED: { label: 'Ur drift', color: 'red' },
      INACTIVE: { label: 'Inaktiv', color: 'gray' },
    }

    return statusMap[status] || { label: status, color: 'gray' }
  }

  // Helper: Calculate lifespan progress
  const calculateLifespanProgress = () => {
    const age = calculateAge(installation?.installationDate)
    const technicalLife = component.model?.subtype?.technicalLifespan

    if (age === null || !technicalLife) return null

    const percentage = Math.min((age / technicalLife) * 100, 100)
    return {
      age,
      percentage,
      remaining: Math.max(technicalLife - age, 0),
    }
  }

  // Helper: Copy to clipboard
  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    })
  }

  // Data extraction
  const installation = component.componentInstallations?.[0]
  const age = calculateAge(installation?.installationDate)
  const installationYear = installation?.installationDate
    ? new Date(installation.installationDate).getFullYear()
    : null
  const warrantyStatus = calculateWarrantyStatus()
  const lifespanProgress = calculateLifespanProgress()
  const statusConfig = getStatusConfig(component.status)

  return (
    <>
      <Card className="w-full">
        {/* HEADER: Always Visible - At A Glance */}
        <CardHeader className="pb-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-base font-semibold">
                  {component.model?.subtype?.componentType?.description}
                  {component.model?.subtype?.componentType?.description &&
                    component.model?.subtype?.subTypeName &&
                    ' • '}
                  {component.model?.subtype?.subTypeName || '-'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {component.model?.manufacturer &&
                  component.model.manufacturer !== 'Unknown'
                    ? `${component.model.manufacturer} | `
                    : ''}
                  {component.model?.modelName}
                </p>
                {component.serialNumber && (
                  <p className="text-xs text-muted-foreground">
                    SN: {component.serialNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {/* Warranty Badge */}
              <Badge
                variant={warrantyStatus.active ? 'default' : 'secondary'}
                className={
                  warrantyStatus.active
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-gray-500'
                }
              >
                {warrantyStatus.active ? '✓' : '✗'}{' '}
                {warrantyStatus.active ? 'Under garanti' : 'Garanti utgången'}
              </Badge>

              {/* Status Badge */}
              <Badge
                variant={
                  statusConfig.color === 'green' ? 'default' : 'secondary'
                }
                className={
                  statusConfig.color === 'green'
                    ? 'bg-green-500 hover:bg-green-600'
                    : statusConfig.color === 'yellow'
                      ? 'bg-yellow-500 hover:bg-yellow-600'
                      : statusConfig.color === 'red'
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-gray-500'
                }
              >
                ● {statusConfig.label}
              </Badge>

              {/* Age */}
              {age !== null && (
                <span className="text-sm text-muted-foreground">
                  Ålder: {age} år
                </span>
              )}

              {/* Images Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGallery(true)}
                className="ml-auto"
                title="Bilder"
              >
                <Images className="h-5 w-5" />
              </Button>
            </div>

            {/* Installation info */}
            <div className="text-sm text-muted-foreground">
              Installerad: {formatDate(installation?.installationDate)}
              {installationYear && ` (Byggår ${installationYear})`}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          <Accordion type="multiple" defaultValue={['status']}>
            {/* SECTION 1: IDENTIFICATION (Collapsed by default) */}
            <AccordionItem value="identification">
              <AccordionTrigger className="text-sm font-medium">
                Identifiering
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Typ:</span>
                    <span className="font-medium">
                      {component.model?.subtype?.componentType?.description ||
                        '-'}{' '}
                      › {component.model?.subtype?.subTypeName || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tillverkare:</span>
                    <span className="font-medium">
                      {component.model?.manufacturer || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Serienummer:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {component.serialNumber || '-'}
                      </span>
                      {component.serialNumber && (
                        <button
                          onClick={() =>
                            copyToClipboard(
                              component.serialNumber ?? '',
                              'serial'
                            )
                          }
                          className="p-1 hover:bg-accent rounded"
                          title="Kopiera serienummer"
                        >
                          <Copy className="h-3 w-3" />
                          {copiedField === 'serial' && (
                            <span className="text-xs text-green-600 ml-1">
                              ✓
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {component.model?.coclassCode && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        CoClass-kod:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {component.model.coclassCode}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              component.model!.coclassCode || '',
                              'coclass'
                            )
                          }
                          className="p-1 hover:bg-accent rounded"
                          title="Kopiera CoClass-kod"
                        >
                          <Copy className="h-3 w-3" />
                          {copiedField === 'coclass' && (
                            <span className="text-xs text-green-600 ml-1">
                              ✓
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {component.ncsCode && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">NCS-kod:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{component.ncsCode}</span>
                        <button
                          onClick={() =>
                            copyToClipboard(component.ncsCode || '', 'ncs')
                          }
                          className="p-1 hover:bg-accent rounded"
                          title="Kopiera NCS-kod"
                        >
                          <Copy className="h-3 w-3" />
                          {copiedField === 'ncs' && (
                            <span className="text-xs text-green-600 ml-1">
                              ✓
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SECTION 2: STATUS & ÅLDER (Expanded by default) */}
            <AccordionItem value="status">
              <AccordionTrigger className="text-sm font-medium">
                Status & Ålder
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {/* Visual Grid */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Ålder</p>
                      <p className="text-lg font-semibold">{age || 0} år</p>
                      {lifespanProgress && (
                        <p className="text-xs text-muted-foreground">
                          ({Math.round(lifespanProgress.percentage)}% sliten)
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Garanti</p>
                      <p
                        className={`text-lg font-semibold ${warrantyStatus.active ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {warrantyStatus.active ? '✓' : '✗'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {warrantyStatus.remaining}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Livslängd</p>
                      <p className="text-lg font-semibold">
                        {component.model?.subtype?.technicalLifespan
                          ? `${component.model.subtype.technicalLifespan} år`
                          : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">(teknisk)</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {lifespanProgress && (
                    <div className="space-y-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            lifespanProgress.percentage < 50
                              ? 'bg-green-500'
                              : lifespanProgress.percentage < 75
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${lifespanProgress.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        {lifespanProgress.remaining} år återstående livslängd
                      </p>
                    </div>
                  )}

                  {/* Details */}
                  <div className="space-y-2 text-sm pt-2 border-t">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Installation:
                      </span>
                      <span className="font-medium">
                        {formatDate(installation?.installationDate)}
                      </span>
                    </div>

                    {installationYear && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Byggår:</span>
                        <span className="font-medium">{installationYear}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium">{statusConfig.label}</span>
                    </div>

                    {component.priceAtPurchase !== null &&
                      component.priceAtPurchase !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">A-pris:</span>
                          <span className="font-medium">
                            {formatCurrency(component.priceAtPurchase)}
                          </span>
                        </div>
                      )}

                    {warrantyStatus.expiryDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Garanti t.o.m:
                        </span>
                        <span className="font-medium">
                          {formatDate(warrantyStatus.expiryDate.toISOString())}
                        </span>
                      </div>
                    )}

                    {component.model?.subtype?.economicLifespan !== null &&
                      component.model?.subtype?.economicLifespan !==
                        undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Ekonomisk livslängd:
                          </span>
                          <span className="font-medium">
                            {component.model.subtype.economicLifespan} år
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SECTION 3: TECHNICAL INFO (Collapsed by default) */}
            <AccordionItem value="technical">
              <AccordionTrigger className="text-sm font-medium">
                Teknisk Information
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm">
                  {component.model?.dimensions && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Mått:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {component.model.dimensions}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              component.model!.dimensions || '',
                              'dimensions'
                            )
                          }
                          className="p-1 hover:bg-accent rounded"
                          title="Kopiera mått"
                        >
                          <Copy className="h-3 w-3" />
                          {copiedField === 'dimensions' && (
                            <span className="text-xs text-green-600 ml-1">
                              ✓
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {component.model?.technicalSpecification && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Specifikationer:
                      </span>
                      <span className="font-medium">
                        {component.model.technicalSpecification}
                      </span>
                    </div>
                  )}

                  {component.model?.installationInstructions && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Dokumentation:
                      </span>
                      <span className="font-medium">
                        {component.model.installationInstructions}
                      </span>
                    </div>
                  )}

                  {component.model?.id && (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDocuments(true)}
                        className="font-medium text-primary hover:text-primary/80"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Visa dokument
                      </Button>
                    </div>
                  )}

                  {!component.model?.dimensions &&
                    !component.model?.technicalSpecification &&
                    !component.model?.installationInstructions &&
                    !component.model?.id && (
                      <p className="text-muted-foreground text-center py-2">
                        Ingen teknisk information tillgänglig
                      </p>
                    )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Action Button */}
          <Button
            className="w-full mt-4"
            variant="outline"
            disabled
            title="Kommer snart: Öppna serviceanmälan"
          >
            <Ticket className="h-4 w-4 mr-2" />
            Öppna Serviceanmälan
          </Button>
        </CardContent>
      </Card>

      {/* Image Gallery Modal */}
      <ComponentImageGallery
        componentId={component.id}
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
      />

      {/* Model Documents Modal */}
      {component.model?.id && (
        <ComponentModelDocuments
          modelId={component.model.id}
          isOpen={showDocuments}
          onClose={() => setShowDocuments(false)}
        />
      )}
    </>
  )
}
