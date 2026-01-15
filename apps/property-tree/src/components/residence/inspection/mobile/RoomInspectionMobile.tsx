import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/v2/Card'
import type { Room } from '@/services/types'
import { ComponentInspectionCard } from '@/components/residence/inspection/ComponentInspectionCard'
import { ComponentDetailSheet } from '@/components/residence/inspection/ComponentDetailSheet'
import type { components } from '@/services/api/core/generated/api-types'
type InspectionRoom = components['schemas']['InspectionRoom']

interface RoomInspectionMobileProps {
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
}

const COMPONENTS: Array<{
  key: keyof InspectionRoom['conditions']
  label: string
  type: 'walls' | 'floor' | 'ceiling' | 'details'
}> = [
  { key: 'wall1', label: 'Vägg 1', type: 'walls' },
  { key: 'wall2', label: 'Vägg 2', type: 'walls' },
  { key: 'wall3', label: 'Vägg 3', type: 'walls' },
  { key: 'wall4', label: 'Vägg 4', type: 'walls' },
  { key: 'floor', label: 'Golv', type: 'floor' },
  { key: 'ceiling', label: 'Tak', type: 'ceiling' },
  { key: 'details', label: 'Detaljer', type: 'details' },
]

export function RoomInspectionMobile({
  room,
  inspectionData,
  onConditionUpdate,
  onActionUpdate,
  onComponentNoteUpdate,
  onComponentPhotoAdd,
  onComponentPhotoRemove,
}: RoomInspectionMobileProps) {
  const [openDetailComponent, setOpenDetailComponent] = useState<
    keyof InspectionRoom['conditions'] | null
  >(null)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 pb-3 border-b border-border">
          <h3 className="font-semibold text-lg">{room.name}</h3>
        </div>

        <div>
          {COMPONENTS.map((component) => (
            <ComponentInspectionCard
              key={component.key}
              componentKey={component.key}
              label={component.label}
              condition={inspectionData.conditions[component.key]}
              note={inspectionData.componentNotes[component.key]}
              photoCount={inspectionData.componentPhotos[component.key].length}
              actions={inspectionData.actions[component.key]}
              onConditionChange={(value) =>
                onConditionUpdate(component.key, value)
              }
              onNoteChange={(note) =>
                onComponentNoteUpdate(component.key, note)
              }
              onPhotoCapture={(photoDataUrl) =>
                onComponentPhotoAdd(component.key, photoDataUrl)
              }
              onOpenDetail={() => setOpenDetailComponent(component.key)}
            />
          ))}
        </div>

        {/* Detail sheets for each component */}
        {COMPONENTS.map((component) => (
          <ComponentDetailSheet
            key={`detail-${component.key}`}
            isOpen={openDetailComponent === component.key}
            onClose={() => setOpenDetailComponent(null)}
            componentKey={component.key}
            label={component.label}
            condition={inspectionData.conditions[component.key]}
            note={inspectionData.componentNotes[component.key]}
            photos={inspectionData.componentPhotos[component.key]}
            actions={inspectionData.actions[component.key]}
            componentType={component.type}
            onNoteChange={(note) => onComponentNoteUpdate(component.key, note)}
            onPhotoAdd={(photoDataUrl) =>
              onComponentPhotoAdd(component.key, photoDataUrl)
            }
            onPhotoRemove={(index) =>
              onComponentPhotoRemove(component.key, index)
            }
            onActionToggle={(action) => onActionUpdate(component.key, action)}
          />
        ))}
      </CardContent>
    </Card>
  )
}
