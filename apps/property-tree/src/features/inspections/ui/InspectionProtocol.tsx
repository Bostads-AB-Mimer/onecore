import { useState } from 'react'
import { components } from '@/services/api/core/generated/api-types'
import { useInspectionPdfDownload } from '../hooks/useInspectionPdfDownload'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/Accordion'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/Collapsible'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Camera, ChevronDown, Key, Home, User, Phone, Mail } from 'lucide-react'

type DetailedInspection = components['schemas']['DetailedInspection']
type DetailedInspectionRoomEntry = DetailedInspection['rooms'][number]

interface InspectionProtocolProps {
  inspection: DetailedInspection | null
  onClose?: () => void
  isOpen?: boolean
}

export function InspectionProtocol({
  inspection,
  onClose,
  isOpen,
}: InspectionProtocolProps) {
  const [expandedPhotos, setExpandedPhotos] = useState<Record<string, boolean>>(
    {}
  )

  const togglePhotoExpansion = (key: string) => {
    setExpandedPhotos((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const { downloadPdf, isDownloading: isDownloadingPdf } =
    useInspectionPdfDownload()

  const handleDownloadPdf = async () => {
    if (!inspection?.id) return
    await downloadPdf(inspection.id)
  }

  const renderHeader = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Besiktningsinfo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4" />
            Besiktningsinformation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Besiktningsnr</span>
            <span className="font-mono">{inspection?.id || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Datum</span>
            <span>
              {inspection
                ? format(new Date(inspection.date), 'yyyy-MM-dd HH:mm')
                : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Besiktigad av</span>
            <span>{inspection?.inspector || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={
                inspection?.status === 'Genomförd' ? 'default' : 'secondary'
              }
            >
              {inspection?.status || 'Okänd'}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1">
              <Key className="h-3 w-3" />
              Huvudnyckel
            </span>
            <span>
              {inspection?.masterKeyAccess
                ? inspection.masterKeyAccess == 'Huvudnyckel'
                  ? 'Ja'
                  : 'Nej'
                : 'Okänt'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Objektinfo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Objekt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {inspection?.residence ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Objektnummer</span>
                <span>{inspection.residenceId || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adress</span>
                <span>{inspection.address || '-'}</span>
              </div>
              {inspection.residence.type.name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lägenhetstyp</span>
                  <span>
                    {inspection.residence.rentalInformation?.type.name}
                  </span>
                </div>
              )}
              {inspection.residence.areaSize && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storlek</span>
                  <span>{inspection.residence.areaSize} kvm</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground italic">
              Ingen objektinformation tillgänglig
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderTenantSnapshot = () => {
    if (inspection?.lease?.tenants?.length === 0) return null

    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Hyresgäst vid besiktningstillfället
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Namn</span>
              <span className="font-medium">
                {inspection?.lease?.tenants?.[0]?.fullName ||
                  inspection?.lease?.tenants?.[0]?.firstName +
                    ' ' +
                    inspection?.lease?.tenants?.[0]?.lastName ||
                  '-'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Personnummer</span>
              {inspection?.lease?.tenants?.[0]?.nationalRegistrationNumber ||
                '-'}
            </div>
            {inspection?.lease?.tenants?.[0]?.phoneNumbers?.find(
              (number) => number.isMainNumber
            )?.phoneNumber && (
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span>
                  {
                    inspection?.lease?.tenants?.[0]?.phoneNumbers?.find(
                      (number) => number.isMainNumber
                    )?.phoneNumber
                  }
                </span>
              </div>
            )}
            {inspection?.lease?.tenants?.[0]?.emailAddress && (
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <span>{inspection?.lease?.tenants?.[0]?.emailAddress}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderComponentPhotos = (
    roomId: string,
    component: string,
    photos: string[]
  ) => {
    if (!photos || photos.length === 0) return null

    const photoKey = `${roomId}-${component}`
    const isExpanded = expandedPhotos[photoKey]

    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={() => togglePhotoExpansion(photoKey)}
      >
        <CollapsibleTrigger className="flex items-center gap-1 text-sm text-primary hover:underline mt-2">
          <Camera className="h-3 w-3" />
          Visa foton ({photos.length})
          <ChevronDown
            className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {photos.map((photo, i) => (
              <img
                key={i}
                src={photo}
                alt={`${component} foto ${i + 1}`}
                className="rounded-md border object-cover aspect-square w-full"
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const renderRooms = () => {
    const rooms = inspection?.rooms ?? []

    if (rooms.length === 0) return null

    return (
      <div className="space-y-4">
        <h3 className="font-medium">Rum ({rooms.length})</h3>
        <Accordion type="single" collapsible className="space-y-2">
          {rooms.map((room: DetailedInspectionRoomEntry) => (
            <AccordionItem
              key={room.room}
              value={room.room}
              className="rounded-lg border border-slate-200 bg-white"
            >
              <AccordionTrigger className="px-3 sm:px-4 py-3 hover:bg-accent/50">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium">{room.room}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-4 pb-4 pt-1 space-y-3">
                  {room.remarks.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Inga anmärkningar registrerade
                    </p>
                  ) : (
                    room.remarks.map((remark) => (
                      <div
                        key={remark.remarkId}
                        className="space-y-1 p-3 bg-muted/30 rounded-lg"
                      >
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            Komponent:
                          </span>{' '}
                          {remark.buildingComponent || 'Ej angivet'}
                        </p>
                        {remark.notes && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">
                              Notering:
                            </span>{' '}
                            {remark.notes}
                          </p>
                        )}
                        <p className="text-sm">
                          <span className="text-muted-foreground">Status:</span>{' '}
                          {remark.remarkStatus || 'Ej angivet'}
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            Kostnad:
                          </span>{' '}
                          {remark.cost !== undefined
                            ? `${remark.cost} kr`
                            : 'Ej angivet'}
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            Ärende skapat:
                          </span>{' '}
                          {remark.workOrderCreated ? 'Ja' : 'Nej'}
                        </p>
                        {remark.workOrderCreated && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">
                              Ärendestatus:
                            </span>{' '}
                            {remark.workOrderStatus || 'Ej angivet'}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    )
  }

  const renderContent = () => (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={!inspection || isDownloadingPdf}
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isDownloadingPdf ? 'Genererar PDF…' : 'Generera PDF'}
        </button>
      </div>
      {renderHeader()}
      <Card>
        <CardContent className="pt-6">
          {renderTenantSnapshot()}
          {renderRooms()}
        </CardContent>
      </Card>
    </div>
  )

  if (isOpen !== undefined) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose!}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Besiktningsprotokoll</DialogTitle>
          </DialogHeader>
          {renderContent()}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">{renderContent()}</CardContent>
    </Card>
  )
}
