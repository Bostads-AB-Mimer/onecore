import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import type { components } from '@/services/api/core/generated/api-types'
import type { Room } from '@/services/types'

import { Button } from '@/shared/ui/Button'
import { Card, CardContent } from '@/shared/ui/Card'
import { Separator } from '@/shared/ui/Separator'
import { Skeleton } from '@/shared/ui/Skeleton'

import {
  type CostResponsibility,
  SURFACE_TYPES,
  getTypeName,
} from '../constants'
import { useRoomComponents } from '../hooks/useRoomComponents'
import {
  deriveRoomIsHandled,
  emptyInspectionComponent,
  getFetchedComponentLabel,
} from '../lib/inspectionComponent'
import { AddSurfaceComponentMenu } from './AddSurfaceComponentMenu'
import { ComponentDetailSheet } from './ComponentDetailSheet'
import { ComponentInspectionCard } from './ComponentInspectionCard'
import { DetailComponentsSection } from './DetailComponentsSection'
import type { ComponentType } from '../constants/actions'

type InspectionRoom = components['schemas']['InspectionRoom']
type InspectionComponent = NonNullable<InspectionRoom['components']>[number]

type OpenDetail = { kind: 'component'; id: string } | null

interface RoomInspectionEditorProps {
  room: Room
  inspectionData: InspectionRoom
  inspectionId: string
  onDetailComponentAdd: (component: { type: string; label: string }) => void
  onDetailComponentRemove: (componentId: string) => void
  onDetailComponentNoteUpdate: (componentId: string, note: string) => void
  onDetailComponentConditionUpdate: (componentId: string, value: string) => void
  onDetailComponentCostUpdate: (componentId: string, cost: number) => void
  onDetailComponentCostResponsibilityUpdate: (
    componentId: string,
    value: CostResponsibility
  ) => void
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
    photoPath: string
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
  onMarkRoomNoRemarks: (
    components: ReadonlyArray<{ id: string; label: string }>
  ) => void
  onRoomHandledChange: (isHandled: boolean) => void
}

export function RoomInspectionEditor({
  room,
  inspectionData,
  inspectionId,
  onDetailComponentAdd,
  onDetailComponentRemove,
  onDetailComponentNoteUpdate,
  onDetailComponentConditionUpdate,
  onDetailComponentCostUpdate,
  onDetailComponentCostResponsibilityUpdate,
  onFetchedComponentConditionUpdate,
  onFetchedComponentActionUpdate,
  onFetchedComponentNoteUpdate,
  onFetchedComponentPhotoAdd,
  onFetchedComponentPhotoRemove,
  onFetchedComponentCostResponsibilityUpdate,
  onMarkRoomNoRemarks,
  onRoomHandledChange,
}: RoomInspectionEditorProps) {
  const [openDetail, setOpenDetail] = useState<OpenDetail>(null)

  const {
    data: fetchedComponents,
    isLoading,
    isError,
  } = useRoomComponents(room.propertyObjectId)

  const missingSurfaces = useMemo(
    () =>
      SURFACE_TYPES.filter(
        (t) => !(fetchedComponents ?? []).some((c) => getTypeName(c) === t)
      ),
    [fetchedComponents]
  )

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

  const getActionComponentType = (
    typeName: string | undefined
  ): ComponentType => {
    if (!typeName) return 'details'
    if (typeName === 'Vägg') return 'walls'
    if (typeName === 'Golv') return 'floor'
    if (typeName === 'Tak') return 'ceiling'
    return 'details'
  }

  const derivedIsHandled = useMemo(() => {
    if (isLoading || isError) return inspectionData.isHandled
    return deriveRoomIsHandled(inspectionData, fetchedComponents ?? [])
  }, [inspectionData, fetchedComponents, isLoading, isError])

  useEffect(() => {
    if (derivedIsHandled !== inspectionData.isHandled) {
      onRoomHandledChange(derivedIsHandled)
    }
  }, [derivedIsHandled, inspectionData.isHandled, onRoomHandledChange])

  const fetchedComponentRefs = useMemo(
    () =>
      (fetchedComponents ?? []).map((component) => ({
        id: component.id,
        label: getFetchedComponentLabel(component),
      })),
    [fetchedComponents]
  )

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 pb-3 border-b border-border flex items-center justify-between gap-3">
          <h3 className="font-semibold text-lg">{room.name}</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMarkRoomNoRemarks(fetchedComponentRefs)}
            disabled={isLoading || fetchedComponentRefs.length === 0}
            className="gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            Utan anmärkningar
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-destructive py-2">
            Kunde inte hämta komponenter för rummet.
          </p>
        )}

        <div>
          {(fetchedComponents ?? []).map((component) => {
            const componentId = component.id
            const label = getFetchedComponentLabel(component)
            const state = getComponentState(componentId, label)
            return (
              <ComponentInspectionCard
                key={componentId}
                componentKey={componentId}
                label={label}
                condition={state.condition}
                note={state.note}
                photoCount={state.photos.length}
                actions={state.action}
                componentType={getActionComponentType(getTypeName(component))}
                costResponsibility={state.costResponsibility ?? null}
                onConditionChange={(value) =>
                  onFetchedComponentConditionUpdate(componentId, label, value)
                }
                onNoteChange={(note) =>
                  onFetchedComponentNoteUpdate(componentId, label, note)
                }
                onActionToggle={(action) =>
                  onFetchedComponentActionUpdate(componentId, label, action)
                }
                onCostResponsibilityChange={(value) =>
                  onFetchedComponentCostResponsibilityUpdate(
                    componentId,
                    label,
                    value
                  )
                }
                onPhotoCaptured={(path) =>
                  onFetchedComponentPhotoAdd(componentId, label, path)
                }
                uploadContext={{
                  inspectionId,
                  roomId: room.id,
                  target: { kind: 'component', componentId },
                }}
                onOpenDetail={() =>
                  setOpenDetail({ kind: 'component', id: componentId })
                }
              />
            )
          })}
        </div>

        <AddSurfaceComponentMenu
          propertyObjectId={room.propertyObjectId}
          missingSurfaces={missingSurfaces}
        />

        <Separator className="my-4" />

        <DetailComponentsSection
          detailComponents={inspectionData.detailComponents ?? []}
          onAdd={onDetailComponentAdd}
          onRemove={onDetailComponentRemove}
          onNoteUpdate={onDetailComponentNoteUpdate}
          onConditionUpdate={onDetailComponentConditionUpdate}
          onCostUpdate={onDetailComponentCostUpdate}
          onCostResponsibilityUpdate={onDetailComponentCostResponsibilityUpdate}
        />

        {(fetchedComponents ?? []).map((component) => {
          const componentId = component.id
          const label = getFetchedComponentLabel(component)
          const state = getComponentState(componentId, label)
          const isOpen =
            openDetail?.kind === 'component' && openDetail.id === componentId
          return (
            <ComponentDetailSheet
              key={`detail-${componentId}`}
              isOpen={isOpen}
              onClose={() => setOpenDetail(null)}
              componentKey={componentId}
              label={label}
              condition={state.condition}
              note={state.note}
              photos={state.photos}
              actions={state.action}
              componentType={getActionComponentType(getTypeName(component))}
              onNoteChange={(note) =>
                onFetchedComponentNoteUpdate(componentId, label, note)
              }
              onPhotoAdd={(path) =>
                onFetchedComponentPhotoAdd(componentId, label, path)
              }
              onPhotoRemove={(index) =>
                onFetchedComponentPhotoRemove(componentId, label, index)
              }
              onActionToggle={(action) =>
                onFetchedComponentActionUpdate(componentId, label, action)
              }
              uploadContext={{
                inspectionId,
                roomId: room.id,
                target: { kind: 'component', componentId },
              }}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}
