import { useEffect, useMemo, useState } from 'react'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { Card, CardContent } from '@/shared/ui/Card'
import { Separator } from '@/shared/ui/Separator'
import { Skeleton } from '@/shared/ui/Skeleton'

import {
  mergeComponentsWithDefaults,
  type CostResponsibility,
} from '../constants'
import { useRoomComponents } from '../hooks/useRoomComponents'
import {
  deriveRoomIsHandled,
  emptyInspectionComponent,
} from '../lib/inspectionComponent'
import { ComponentDetailSheet } from './ComponentDetailSheet'
import { ComponentInspectionCard } from './ComponentInspectionCard'
import { DetailComponentsSection } from './DetailComponentsSection'

type InspectionRoom = components['schemas']['InspectionRoom']
type InspectionComponent = NonNullable<InspectionRoom['components']>[number]

type OpenDetail =
  | { kind: 'surface'; key: keyof InspectionRoom['conditions'] }
  | { kind: 'component'; id: string }
  | null

interface RoomInspectionEditorProps {
  room: Room
  inspectionData: InspectionRoom
  inspectionId: string | undefined
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
  onComponentCostResponsibilityUpdate: (
    field: keyof InspectionRoom['componentCostResponsibilities'],
    value: CostResponsibility
  ) => void
  onDetailComponentAdd: (component: { type: string; label: string }) => void
  onDetailComponentRemove: (componentId: string) => void
  onDetailComponentNoteUpdate: (componentId: string, note: string) => void
  onFetchedComponentConditionUpdate: (
    componentId: string,
    label: string,
    value: string
  ) => void
  onFetchedComponentActionUpdate: (
    componentId: string,
    label: string,
    action: string
  ) => void
  onFetchedComponentNoteUpdate: (
    componentId: string,
    label: string,
    note: string
  ) => void
  onFetchedComponentPhotoAdd: (
    componentId: string,
    label: string,
    photoDataUrl: string
  ) => void
  onFetchedComponentPhotoRemove: (
    componentId: string,
    label: string,
    index: number
  ) => void
  onFetchedComponentCostResponsibilityUpdate: (
    componentId: string,
    label: string,
    value: CostResponsibility
  ) => void
  onRoomHandledChange: (isHandled: boolean) => void
}

export function RoomInspectionEditor({
  room,
  inspectionData,
  inspectionId,
  onConditionUpdate,
  onActionUpdate,
  onComponentNoteUpdate,
  onComponentPhotoAdd,
  onComponentPhotoRemove,
  onComponentCostResponsibilityUpdate,
  onDetailComponentAdd,
  onDetailComponentRemove,
  onDetailComponentNoteUpdate,
  onFetchedComponentConditionUpdate,
  onFetchedComponentActionUpdate,
  onFetchedComponentNoteUpdate,
  onFetchedComponentPhotoAdd,
  onFetchedComponentPhotoRemove,
  onFetchedComponentCostResponsibilityUpdate,
  onRoomHandledChange,
}: RoomInspectionEditorProps) {
  const [openDetail, setOpenDetail] = useState<OpenDetail>(null)

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

  const componentsByIdMemo = useMemo(() => {
    const map = new Map<string, InspectionComponent>()
    for (const c of inspectionData.components ?? []) {
      map.set(c.componentId, c)
    }
    return map
  }, [inspectionData.components])

  const getComponentState = (
    componentId: string,
    label: string
  ): InspectionComponent =>
    componentsByIdMemo.get(componentId) ??
    emptyInspectionComponent(componentId, label)

  // A room is handled when every visible row has a condition set. Derived
  // here because the set of visible rows depends on fetched components, which
  // the data hook cannot see. See deriveRoomIsHandled for the rule.
  const derivedIsHandled = useMemo(
    () => deriveRoomIsHandled(inspectionData, fetchedComponents ?? []),
    [inspectionData, fetchedComponents]
  )

  useEffect(() => {
    if (derivedIsHandled !== inspectionData.isHandled) {
      onRoomHandledChange(derivedIsHandled)
    }
  }, [derivedIsHandled, inspectionData.isHandled, onRoomHandledChange])

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
                costResponsibility={
                  inspectionData.componentCostResponsibilities[surfaceKey] ??
                  null
                }
                onConditionChange={(value) =>
                  onConditionUpdate(surfaceKey, value)
                }
                onNoteChange={(note) => onComponentNoteUpdate(surfaceKey, note)}
                onCostResponsibilityChange={(value) =>
                  onComponentCostResponsibilityUpdate(surfaceKey, value)
                }
                onPhotoCaptured={(path) =>
                  onComponentPhotoAdd(surfaceKey, path)
                }
                uploadContext={{
                  inspectionId,
                  roomId: room.id,
                  roomName: room.name,
                  target: { kind: 'surface', surfaceKey },
                }}
                onOpenDetail={() =>
                  setOpenDetail({ kind: 'surface', key: surfaceKey })
                }
              />
            )
          })}

          {equipmentRows.map((row) => {
            const componentId = row.componentId
            if (!componentId) return null
            const state = getComponentState(componentId, row.label)
            return (
              <ComponentInspectionCard
                key={row.key}
                componentKey={row.key}
                label={row.label}
                condition={state.condition}
                note={state.note}
                photoCount={state.photos.length}
                actions={state.action}
                costResponsibility={state.costResponsibility ?? null}
                onConditionChange={(value) =>
                  onFetchedComponentConditionUpdate(
                    componentId,
                    row.label,
                    value
                  )
                }
                onNoteChange={(note) =>
                  onFetchedComponentNoteUpdate(componentId, row.label, note)
                }
                onCostResponsibilityChange={(value) =>
                  onFetchedComponentCostResponsibilityUpdate(
                    componentId,
                    row.label,
                    value
                  )
                }
                onPhotoCaptured={(path) =>
                  onFetchedComponentPhotoAdd(componentId, row.label, path)
                }
                uploadContext={{
                  inspectionId,
                  roomId: room.id,
                  roomName: room.name,
                  target: { kind: 'component', componentId },
                }}
                onOpenDetail={() =>
                  setOpenDetail({ kind: 'component', id: componentId })
                }
              />
            )
          })}
        </div>

        <Separator className="my-4" />

        <DetailComponentsSection
          detailComponents={inspectionData.detailComponents ?? []}
          onAdd={onDetailComponentAdd}
          onRemove={onDetailComponentRemove}
          onNoteUpdate={onDetailComponentNoteUpdate}
        />

        {defaultRows.map((row) => {
          const surfaceKey = row.key as keyof InspectionRoom['conditions']
          const isOpen =
            openDetail?.kind === 'surface' && openDetail.key === surfaceKey
          return (
            <ComponentDetailSheet
              key={`detail-${row.key}`}
              isOpen={isOpen}
              onClose={() => setOpenDetail(null)}
              componentKey={row.key}
              label={row.label}
              condition={inspectionData.conditions[surfaceKey]}
              note={inspectionData.componentNotes[surfaceKey]}
              photos={inspectionData.componentPhotos[surfaceKey]}
              actions={inspectionData.actions[surfaceKey]}
              componentType={row.type}
              onNoteChange={(note) => onComponentNoteUpdate(surfaceKey, note)}
              onPhotoAdd={(path) => onComponentPhotoAdd(surfaceKey, path)}
              onPhotoRemove={(index) =>
                onComponentPhotoRemove(surfaceKey, index)
              }
              onActionToggle={(action) => onActionUpdate(surfaceKey, action)}
              uploadContext={{
                inspectionId,
                roomId: room.id,
                roomName: room.name,
                target: { kind: 'surface', surfaceKey },
              }}
            />
          )
        })}

        {equipmentRows.map((row) => {
          const componentId = row.componentId
          if (!componentId) return null
          const state = getComponentState(componentId, row.label)
          const isOpen =
            openDetail?.kind === 'component' && openDetail.id === componentId
          return (
            <ComponentDetailSheet
              key={`detail-${row.key}`}
              isOpen={isOpen}
              onClose={() => setOpenDetail(null)}
              componentKey={row.key}
              label={row.label}
              condition={state.condition}
              note={state.note}
              photos={state.photos}
              actions={state.action}
              componentType={row.type}
              onNoteChange={(note) =>
                onFetchedComponentNoteUpdate(componentId, row.label, note)
              }
              onPhotoAdd={(path) =>
                onFetchedComponentPhotoAdd(componentId, row.label, path)
              }
              onPhotoRemove={(index) =>
                onFetchedComponentPhotoRemove(componentId, row.label, index)
              }
              onActionToggle={(action) =>
                onFetchedComponentActionUpdate(componentId, row.label, action)
              }
              uploadContext={{
                inspectionId,
                roomId: room.id,
                roomName: room.name,
                target: { kind: 'component', componentId },
              }}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}
