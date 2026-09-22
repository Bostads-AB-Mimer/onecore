import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

export interface SortableHandleProps {
  /** Spread onto the element that should start a drag. */
  attributes: React.HTMLAttributes<HTMLElement>
  listeners: Record<string, unknown> | undefined
}

interface SortableListProps<T> {
  items: T[]
  getId: (item: T) => string
  onMove: (from: number, to: number) => void
  renderItem: (
    item: T,
    index: number,
    handle: SortableHandleProps
  ) => React.ReactNode
  className?: string
}

/**
 * Vertical drag-and-drop list. Dragging starts from the handle the consumer
 * renders; keyboard users can also pick up with Space and move with arrows.
 * Consumers should still offer up/down buttons for a fully discoverable
 * keyboard path.
 */
export function SortableList<T>({
  items,
  getId,
  onMove,
  renderItem,
  className,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const ids = items.map(getId)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onMove(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className={cn('space-y-3', className)}>
          {items.map((item, index) => (
            <SortableRow key={ids[index]} id={ids[index]}>
              {(handle) => renderItem(item, index, handle)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

interface SortableRowProps {
  id: string
  children: (handle: SortableHandleProps) => React.ReactNode
}

function SortableRow({ id, children }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'z-10 opacity-80 shadow-lg')}
    >
      {children({ attributes, listeners })}
    </li>
  )
}

/** Default grab handle; spread the handle props from renderItem onto it. */
export function SortableHandle({
  attributes,
  listeners,
  label = 'Dra för att flytta',
  className,
}: SortableHandleProps & { label?: string; className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        'cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        className
      )}
      aria-label={label}
      title={label}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}
