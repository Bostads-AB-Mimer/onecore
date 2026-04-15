import { useMemo, useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { Card, CardContent } from '@/shared/ui/Card'
import { Separator } from '@/shared/ui/Separator'
import { Skeleton } from '@/shared/ui/Skeleton'

import { mergeComponentsWithDefaults } from '../constants'
import { useRoomComponents } from '../hooks/useRoomComponents'
import { ComponentDetailSheet } from './ComponentDetailSheet'
import { ComponentInspectionCard } from './ComponentInspectionCard'
import { DetailComponentsSection } from './DetailComponentsSection'

type InspectionRoom = components['schemas']['InspectionRoom']

interface RoomInspectionEditorProps {
  room: Room
  inspectionData: InspectionRoom
  onConditionUpdate: (
    field: keyof InspectionRoom['conditions'],
    value: string
  ) => void
  onActionUpdate: (
    field: keyof InspectionRoom['actions'],
    action: string
  ) => void
  onComponentNoteUpdate: (
    field: keyof InspectionRoom['componentNotes'],
    note: string
  ) => void
  onComponentPhotoAdd: (
    field: keyof InspectionRoom['componentPhotos'],
    photoDataUrl: string
  ) => void
  onComponentPhotoRemove: (
    field: keyof InspectionRoom['componentPhotos'],
    index: number
  ) => void
  onDetailComponentAdd: (component: { type: string; label: string }) => void
  onDetailComponentRemove: (componentId: string) => void
  onDetailComponentNoteUpdate: (componentId: string, note: string) => void
}

export function RoomInspectionEditor({
  room,
  inspectionData,
  onConditionUpdate,
  onActionUpdate,
  onComponentNoteUpdate,
  onComponentPhotoAdd,
  onComponentPhotoRemove,
  onDetailComponentAdd,
  onDetailComponentRemove,
  onDetailComponentNoteUpdate,
}: RoomInspectionEditorProps) {
  const [openDetailKey, setOpenDetailKey] = useState<
    keyof InspectionRoom['conditions'] | null
  >(null)

  const {
    data: fetchedComponents,
    isLoading,
    isError,
  } = useRoomComponents(room.propertyObjectId)

  const rows = useMemo(
    () => mergeComponentsWithDefaults(fetchedComponents ?? []),
    [fetchedComponents]
  )

  const defaultRows = rows.filter((r) => r.isDefault)
  const equipmentRows = rows.filter((r) => !r.isDefault)

  // Equipment rows render with the same UI as defaults for visual consistency,
  // but inputs are non-persisted in this card — see follow-up "Spara
  // besiktningsframsteg per komponent".
  const noop = () => {}

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 pb-3 border-b border-border">
          <h3 className="font-semibold text-lg">{room.name}</h3>
        </div>

        {isLoading && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive py-2">
            Kunde inte hämta komponenter för rummet. Visar endast standardytor.
          </p>
        )}

        <div>
          {defaultRows.map((row) => {
            const surfaceKey = row.key as keyof InspectionRoom['conditions']
            return (
              <ComponentInspectionCard
                key={row.key}
                componentKey={row.key}
                label={row.label}
                condition={inspectionData.conditions[surfaceKey]}
                note={inspectionData.componentNotes[surfaceKey]}
                photoCount={inspectionData.componentPhotos[surfaceKey].length}
                actions={inspectionData.actions[surfaceKey]}
                onConditionChange={(value) =>
                  onConditionUpdate(surfaceKey, value)
                }
                onNoteChange={(note) => onComponentNoteUpdate(surfaceKey, note)}
                onPhotoCapture={(photoDataUrl) =>
                  onComponentPhotoAdd(surfaceKey, photoDataUrl)
                }
                onOpenDetail={() => setOpenDetailKey(surfaceKey)}
              />
            )
          })}

          {equipmentRows.map((row) => (
            <div
              key={row.key}
              className="opacity-60 pointer-events-none"
              aria-disabled
            >
              <ComponentInspectionCard
                componentKey={row.key}
                label={row.label}
                condition=""
                note=""
                photoCount={0}
                actions={[]}
                onConditionChange={noop}
                onNoteChange={noop}
                onPhotoCapture={noop}
                onOpenDetail={noop}
              />
              <p className="text-xs text-muted-foreground -mt-2 mb-3 px-1">
                Sparas inte än
              </p>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <DetailComponentsSection
          detailComponents={inspectionData.detailComponents ?? []}
          onAdd={onDetailComponentAdd}
          onRemove={onDetailComponentRemove}
          onNoteUpdate={onDetailComponentNoteUpdate}
        />

        {/* Detail sheets for surface defaults only */}
        {defaultRows.map((row) => {
          const surfaceKey = row.key as keyof InspectionRoom['conditions']
          return (
            <ComponentDetailSheet
              key={`detail-${row.key}`}
              isOpen={openDetailKey === surfaceKey}
              onClose={() => setOpenDetailKey(null)}
              componentKey={row.key}
              label={row.label}
              condition={inspectionData.conditions[surfaceKey]}
              note={inspectionData.componentNotes[surfaceKey]}
              photos={inspectionData.componentPhotos[surfaceKey]}
              actions={inspectionData.actions[surfaceKey]}
              componentType={row.type}
              onNoteChange={(note) => onComponentNoteUpdate(surfaceKey, note)}
              onPhotoAdd={(photoDataUrl) =>
                onComponentPhotoAdd(surfaceKey, photoDataUrl)
              }
              onPhotoRemove={(index) =>
                onComponentPhotoRemove(surfaceKey, index)
              }
              onActionToggle={(action) => onActionUpdate(surfaceKey, action)}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}
