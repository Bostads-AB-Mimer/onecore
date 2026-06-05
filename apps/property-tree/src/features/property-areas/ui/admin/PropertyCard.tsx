import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Car, DoorOpen, GripVertical, Home } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import { PropertyForAdmin } from '../../types/adminTypes'
import { AddressList } from '../AddressList'
import { BuildingTypeBadge } from '../BuildingTypeBadge'

interface PropertyCardProps {
  property: PropertyForAdmin
  // Controls whether the grip handle is rendered (the visual affordance).
  draggable?: boolean
  // When true, the grip handle stays visible but drag is inert — used during
  // an in-flight save so the UI doesn't stutter from cards relayouting.
  dragDisabled?: boolean
  isPending?: boolean
  // When true, the card renders as a visible overlay (for the DragOverlay portal).
  // The "real" draggable card hides itself while dragging so its column slot
  // stays reserved but invisible.
  isOverlay?: boolean
}

export function PropertyCard({
  property,
  draggable = false,
  dragDisabled = false,
  isPending = false,
  isOverlay = false,
}: PropertyCardProps) {
  const hasCounts =
    (property.residenceCount ?? 0) > 0 ||
    (property.parkingCount ?? 0) > 0 ||
    (property.entranceCount ?? 0) > 0

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: property.id,
    disabled: !draggable || dragDisabled || isOverlay,
    data: {
      type: 'property',
      propertyCode: property.propertyCode,
      kvvAreaId: property.kvvAreaId,
      propertyName: property.propertyName,
    },
  })

  // Overlay renders freely (positioned by DragOverlay). The "real" card holds
  // its layout slot but stays at translate(0,0) — applying useDraggable's
  // transform would make the hidden card occupy off-screen space and force
  // the source column to scroll horizontally.
  const style: React.CSSProperties = isOverlay
    ? {}
    : isDragging
      ? { visibility: 'hidden' }
      : {}

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className={cn(
        'p-3 rounded-md border bg-card',
        draggable && 'flex gap-2',
        isPending && 'border-2 border-orange-500',
        isOverlay && 'shadow-lg cursor-grabbing'
      )}
    >
      {draggable && (
        <button
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
          type="button"
          className="text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing flex-shrink-0 mt-0.5"
          aria-label="Dra för att flytta fastigheten"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm break-words">
          {property.propertyName}
        </div>
        <AddressList addresses={property.addresses} />
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
