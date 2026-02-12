import { useState } from 'react'
import { Card, CardContent } from '@/shared/ui/Card'
import type { Room } from '@/services/types'
import { ComponentInspectionCard } from './ComponentInspectionCard'
import { ComponentDetailSheet } from './ComponentDetailSheet'
import type { components } from '@/services/api/core/generated/api-types'
import { ROOM_COMPONENTS } from '../constants'

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
}

export function RoomInspectionEditor({
  room,
  inspectionData,
  onConditionUpdate,
  onActionUpdate,
  onComponentNoteUpdate,
  onComponentPhotoAdd,
  onComponentPhotoRemove,
}: RoomInspectionEditorProps) {
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
          {ROOM_COMPONENTS.map((component) => (
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
        {ROOM_COMPONENTS.map((component) => (
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
