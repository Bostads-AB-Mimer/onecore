import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft } from 'lucide-react'

import type {
  InspectionSubmitData,
  TenantInfoCardData,
  TenantSnapshot,
} from '@/features/inspections/types/index'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { getFloorplanUrl } from '@/shared/lib/floorplan'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/Accordion'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'

import { useInspectionForm } from '../hooks/useInspectionForm'
import { InspectionInfoSection } from './InspectionInfoSection'
import { InspectionMoreMenu } from './InspectionMoreMenu'
import { InspectionSummary } from './InspectionSummary'
import { RoomInspectionEditor } from './RoomInspectionEditor'
import { SaveDraftConfirmDialog } from './SaveDraftConfirmDialog'
type Inspection = components['schemas']['InternalInspection']
type InspectionRoom = components['schemas']['InspectionRoom']

interface InspectionFormProps {
  rooms: Room[]
  onSave: (
    inspectorName: string,
    rooms: Record<string, InspectionRoom>,
    status: 'draft' | 'completed',
    additionalData: InspectionSubmitData
  ) => void
  onCancel: () => void
  tenant?: TenantInfoCardData
  address?: string
  apartmentCode?: string | null
  existingInspection?: Inspection
  rentalId?: string
}

const currentUser = 'Anna Andersson'

export function InspectionForm({
  rooms,
  onSave,
  onCancel,
  tenant,
  address,
  apartmentCode,
  existingInspection,
  rentalId,
}: InspectionFormProps) {
  const floorplanImage = rentalId ? getFloorplanUrl(rentalId) : undefined
  const {
    inspectorName,
    setInspectorName,
    needsMasterKey,
    setNeedsMasterKey,
    isFurnished,
    setIsFurnished,
    inspectionData,
    handleConditionUpdate,
    handleActionUpdate,
    handleComponentNoteUpdate,
    handleComponentPhotoAdd,
    handleComponentPhotoRemove,
    handleDetailComponentAdd,
    handleDetailComponentRemove,
    handleDetailComponentNoteUpdate,
  } = useInspectionForm(rooms, existingInspection)

  useEffect(() => {
    if (!inspectorName && currentUser && !existingInspection) {
      setInspectorName(currentUser)
    }
  }, [inspectorName, setInspectorName, existingInspection])

  const completedRooms = Object.values(inspectionData).filter(
    (room) => room.isHandled
  ).length

  const canComplete = inspectorName && completedRooms === rooms.length

  const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false)
  const [step, setStep] = useState<'rooms' | 'summary'>('rooms')

  const createTenantSnapshot = (): TenantSnapshot | undefined => {
    if (!tenant) return undefined
    return {
      name: tenant.fullName ?? '',
      personalNumber: '',
    }
  }

  const handleSubmit = () => {
    if (canComplete) {
      onSave(inspectorName, inspectionData, 'completed', {
        needsMasterKey,
        isFurnished,
        tenant: createTenantSnapshot(),
      })
    }
  }

  const handleConfirmSaveDraft = () => {
    onSave(inspectorName, inspectionData, 'draft', {
      needsMasterKey,
      isFurnished,
      tenant: createTenantSnapshot(),
    })
    setIsDraftConfirmOpen(false)
  }

  return (
    <div className="space-y-6 min-w-0">
      <InspectionInfoSection
        inspectorName={inspectorName}
        setInspectorName={setInspectorName}
        tenant={tenant}
        address={address}
        apartmentCode={apartmentCode}
        layout="horizontal"
      />

      {/* Progress counter */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <span className="text-sm font-medium">Besiktningsframsteg</span>
        <span className="text-sm text-muted-foreground">
          {completedRooms}/{rooms.length} rum klara
        </span>
      </div>

      {step === 'rooms' && (
        <div className="max-h-[70vh] overflow-y-auto pr-2 pb-24 min-w-0">
          <Accordion type="multiple" className="space-y-2">
            {rooms.map((room) => {
              const roomData = inspectionData[room.id]
              const isCompleted = roomData?.isHandled

              return (
                <AccordionItem
                  key={room.id}
                  value={room.id}
                  className="border rounded-lg"
                >
                  <AccordionTrigger className="hover:no-underline sticky top-0 bg-background z-10">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{room.name}</span>
                      </div>
                      {isCompleted && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Klar
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pr-4 min-w-0">
                    <RoomInspectionEditor
                      room={room}
                      inspectionData={roomData}
                      onConditionUpdate={(field, value) =>
                        handleConditionUpdate(room.id, field, value)
                      }
                      onActionUpdate={(field, action) =>
                        handleActionUpdate(room.id, field, action)
                      }
                      onComponentNoteUpdate={(field, note) =>
                        handleComponentNoteUpdate(room.id, field, note)
                      }
                      onComponentPhotoAdd={(field, photoDataUrl) =>
                        handleComponentPhotoAdd(room.id, field, photoDataUrl)
                      }
                      onComponentPhotoRemove={(field, index) =>
                        handleComponentPhotoRemove(room.id, field, index)
                      }
                      onDetailComponentAdd={(component) =>
                        handleDetailComponentAdd(room.id, component)
                      }
                      onDetailComponentRemove={(componentId) =>
                        handleDetailComponentRemove(room.id, componentId)
                      }
                      onDetailComponentNoteUpdate={(componentId, note) =>
                        handleDetailComponentNoteUpdate(
                          room.id,
                          componentId,
                          note
                        )
                      }
                    />
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </div>
      )}

      {step === 'summary' && (
        <div className="max-h-[70vh] overflow-y-auto pr-2 pb-24 min-w-0">
          <Button
            variant="link"
            onClick={() => setStep('rooms')}
            className="h-auto p-0 mb-4"
          >
            <ChevronLeft />
            Tillbaka till rum
          </Button>
          <InspectionSummary inspectionData={inspectionData} rooms={rooms} />
          <div
            className="mt-4 p-4 border rounded-lg space-y-3"
            role="radiogroup"
            aria-label="Är bostaden möblerad vid besiktningstillfället?"
          >
            <div className="text-sm font-medium">
              Är bostaden möblerad vid besiktningstillfället?
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                role="radio"
                aria-checked={isFurnished}
                variant={isFurnished ? 'default' : 'outline'}
                onClick={() => setIsFurnished(true)}
              >
                Ja
              </Button>
              <Button
                type="button"
                role="radio"
                aria-checked={!isFurnished}
                variant={!isFurnished ? 'default' : 'outline'}
                onClick={() => setIsFurnished(false)}
              >
                Nej
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer buttons */}

      <div className="flex gap-3 justify-between pt-4 border-t">
        <InspectionMoreMenu floorplanImage={floorplanImage} />
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            Avbryt
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsDraftConfirmOpen(true)}
            disabled={!inspectorName.trim()}
          >
            Spara utkast
          </Button>

          {step === 'rooms' && (
            <Button
              onClick={() => setStep('summary')}
              disabled={!inspectorName.trim()}
            >
              Sammanställning
            </Button>
          )}
          {step === 'summary' && (
            <Button onClick={handleSubmit} disabled={!canComplete}>
              Slutför besiktning
            </Button>
          )}
        </div>
      </div>

      <SaveDraftConfirmDialog
        open={isDraftConfirmOpen}
        onOpenChange={setIsDraftConfirmOpen}
        onConfirm={handleConfirmSaveDraft}
      />
    </div>
  )
}
