import { useState } from 'react'
import { components } from '@/services/api/core/generated/api-types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v2/Dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v2/Collapsible'
import { format } from 'date-fns'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { Badge } from '@/components/ui/v3/Badge'
import { Camera, ChevronDown, Key, Home, User, Phone, Mail } from 'lucide-react'

type Inspection = components['schemas']['Inspection']
type InspectionRoom = components['schemas']['InspectionRoom']

interface InspectionReadOnlyProps {
  inspection: Inspection | null
  onClose?: () => void
  isOpen?: boolean
}

export function InspectionReadOnly({
  inspection,
  onClose,
  isOpen,
}: InspectionReadOnlyProps) {
  const [expandedPhotos, setExpandedPhotos] = useState<Record<string, boolean>>(
    {}
  )

  const togglePhotoExpansion = (key: string) => {
    setExpandedPhotos((prev) => ({ ...prev, [key]: !prev[key] }))
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
                inspection?.status === 'completed' ? 'default' : 'secondary'
              }
            >
              {inspection?.status === 'completed'
                ? 'Slutförd'
                : inspection?.status === 'draft'
                  ? 'Utkast'
                  : 'Pågående'}
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
      {/* <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Objekt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {inspection.residence ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Objektnummer</span>
                <span className="font-mono">
                  {inspection.residence.objectNumber || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adress</span>
                <span>{inspection.residence.address || '-'}</span>
              </div>
              {inspection.residence.apartmentType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lägenhetstyp</span>
                  <span>{inspection.residence.apartmentType}</span>
                </div>
              )}
              {inspection.residence.size && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storlek</span>
                  <span>{inspection.residence.size} kvm</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground italic">
              Ingen objektinformation tillgänglig
            </p>
          )}
        </CardContent>
      </Card> */}
    </div>
  )

  // const renderTenantSnapshot = () => {
  //   if (!inspection.tenant) return null

  //   return (
  //     <Card className="mb-6">
  //       <CardHeader className="pb-3">
  //         <CardTitle className="text-base flex items-center gap-2">
  //           <User className="h-4 w-4" />
  //           Hyresgäst vid besiktningstillfället
  //         </CardTitle>
  //       </CardHeader>
  //       <CardContent>
  //         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
  //           <div>
  //             <span className="text-muted-foreground block">Namn</span>
  //             <span className="font-medium">
  //               {inspection.tenant.name || '-'}
  //             </span>
  //           </div>
  //           <div>
  //             <span className="text-muted-foreground block">Personnummer</span>
  //             <span className="font-mono">
  //               {inspection.tenant.personalNumber || '-'}
  //             </span>
  //           </div>
  //           {inspection.tenant.phone && (
  //             <div className="flex items-center gap-2">
  //               <Phone className="h-3 w-3 text-muted-foreground" />
  //               <span>{inspection.tenant.phone}</span>
  //             </div>
  //           )}
  //           {inspection.tenant.email && (
  //             <div className="flex items-center gap-2">
  //               <Mail className="h-3 w-3 text-muted-foreground" />
  //               <span>{inspection.tenant.email}</span>
  //             </div>
  //           )}
  //         </div>
  //       </CardContent>
  //     </Card>
  //   )
  // }

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

  // const renderRooms = () => (
  //   <div className="space-y-4">
  //     <h3 className="font-medium">
  //       Rum ({Object.keys(inspection.rooms).length})
  //     </h3>
  //     <Accordion type="single" collapsible className="space-y-2">
  //       {Object.entries(inspection.rooms).map(
  //         ([roomId, room]: [string, InspectionRoom]) => (
  //           <AccordionItem
  //             key={roomId}
  //             value={roomId}
  //             className="rounded-lg border border-slate-200 bg-white"
  //           >
  //             <AccordionTrigger className="px-3 sm:px-4 py-3 hover:bg-accent/50">
  //               <div className="flex items-center gap-2">
  //                 <span className="text-lg font-medium">Rum {roomId}</span>
  //                 {room.isHandled && (
  //                   <Badge variant="default" className="text-xs">
  //                     Hanterat
  //                   </Badge>
  //                 )}
  //               </div>
  //             </AccordionTrigger>
  //             <AccordionContent>
  //               <div className="px-4 pb-4 pt-1 space-y-4">
  //                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  //                   {Object.entries(room.conditions).map(
  //                     ([component, condition]) => (
  //                       <div
  //                         key={component}
  //                         className="space-y-2 p-3 bg-muted/30 rounded-lg"
  //                       >
  //                         <h4 className="font-medium capitalize">
  //                           {component}
  //                         </h4>
  //                         <p className="text-sm">
  //                           <span className="text-muted-foreground">
  //                             Skick:
  //                           </span>{' '}
  //                           {condition || 'Ej angivet'}
  //                         </p>

  //                         {/* Åtgärder */}
  //                         <div className="text-sm">
  //                           <p className="text-muted-foreground">Åtgärder:</p>
  //                           {room.actions[
  //                             component as keyof typeof room.actions
  //                           ]?.length > 0 ? (
  //                             <ul className="list-disc list-inside mt-1">
  //                               {room.actions[
  //                                 component as keyof typeof room.actions
  //                               ].map((action, index) => (
  //                                 <li key={index}>{action}</li>
  //                               ))}
  //                             </ul>
  //                           ) : (
  //                             <p className="text-muted-foreground/70 italic">
  //                               Inga åtgärder
  //                             </p>
  //                           )}
  //                         </div>

  //                         {/* Anteckningar */}
  //                         {room.componentNotes[
  //                           component as keyof typeof room.componentNotes
  //                         ] && (
  //                           <div className="text-sm">
  //                             <p className="text-muted-foreground">
  //                               Anteckningar:
  //                             </p>
  //                             <p className="mt-1">
  //                               {
  //                                 room.componentNotes[
  //                                   component as keyof typeof room.componentNotes
  //                                 ]
  //                               }
  //                             </p>
  //                           </div>
  //                         )}

  //                         {/* Expanderbara foton */}
  //                         {renderComponentPhotos(
  //                           roomId,
  //                           component,
  //                           room.componentPhotos?.[
  //                             component as keyof typeof room.componentPhotos
  //                           ] || []
  //                         )}
  //                       </div>
  //                     )
  //                   )}
  //                 </div>
  //               </div>
  //             </AccordionContent>
  //           </AccordionItem>
  //         )
  //       )}
  //     </Accordion>
  //   </div>
  // )

  const renderContent = () => (
    <div className="space-y-6">
      {renderHeader()}
      {/* {renderTenantSnapshot()}
      {renderRooms()} */}
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
