import React from 'react'
import { GripVertical, Home, DoorOpen, Car } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PropertyForAdmin } from '../../types/adminTypes'
import { BuildingTypeBadge } from '../BuildingTypeBadge'

interface PropertyCardProps {
  property: PropertyForAdmin
  kvvArea: string
}

export function PropertyCard({ property, kvvArea }: PropertyCardProps) {
  const hasCounts =
    (property.residenceCount ?? 0) > 0 ||
    (property.parkingCount ?? 0) > 0 ||
    (property.entranceCount ?? 0) > 0

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: property.id,
    data: { type: 'property', kvvArea },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 rounded-md border bg-card flex gap-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing flex-shrink-0 mt-0.5"
        aria-label="Dra för att flytta fastigheten"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm break-words">
          {property.propertyName}
        </div>
        <div className="text-xs text-muted-foreground break-words">
          {property.address}
        </div>
        <BuildingTypeBadge type={property.buildingType} className="mt-1" />
        {hasCounts && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
            {(property.entranceCount ?? 0) > 0 && (
              <span className="flex items-center gap-1" title="Uppgångar">
                <Home className="h-3.5 w-3.5" />
                {property.entranceCount}
              </span>
            )}
            {(property.residenceCount ?? 0) > 0 && (
              <span className="flex items-center gap-1" title="Bostäder">
                <DoorOpen className="h-3.5 w-3.5" />
                {property.residenceCount}
              </span>
            )}
            {(property.parkingCount ?? 0) > 0 && (
              <span className="flex items-center gap-1" title="P-platser">
                <Car className="h-3.5 w-3.5" />
                {property.parkingCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
