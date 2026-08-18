import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Checkbox } from '@/shared/ui/Checkbox'
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/ui/Popover'

import { RENTAL_OBJECT_GROUP_LABELS } from '../hooks/useOccupantData'
import {
  subtypeKey,
  useRentalObjectSubtypes,
} from '../hooks/useRentalObjectSubtypes'
import type { RentalObjectType } from '../model/selection'
import { ALL_RENTAL_OBJECT_TYPES } from '../model/selection'
import { OBJECT_TYPE_ICONS } from './icons'

interface ObjectTypeFilterButtonGroupProps {
  /** Page-owned object-type filter (all four = no restriction). */
  activeObjectTypes: ReadonlySet<RentalObjectType>
  onToggleObjectType: (type: RentalObjectType) => void
  /** Selected subtypes as `type:code` keys; empty = no subtype restriction. */
  activeSubtypes: ReadonlySet<string>
  onToggleSubtype: (key: string) => void
}

/**
 * The picker's object-type buttons, each with its own subtype menu. The filter
 * state stays page-owned; the only state here is which menu is open.
 */
export function ObjectTypeFilterButtonGroup({
  activeObjectTypes,
  onToggleObjectType,
  activeSubtypes,
  onToggleSubtype,
}: ObjectTypeFilterButtonGroupProps) {
  const [subtypeMenu, setSubtypeMenu] = useState<RentalObjectType | null>(null)
  // Clicks inside the group must not count as outside-clicks: the chevrons'
  // own onClick decides whether the menu toggles or switches type.
  const groupRef = useRef<HTMLDivElement>(null)
  const { byType: subtypesByType } = useRentalObjectSubtypes()

  /** Subtype checkboxes for one object type. */
  const renderSubtypeMenu = (type: RentalObjectType) => {
    const options = subtypesByType.get(type) ?? []
    const chosenKeys = options
      .map((s) => subtypeKey(type, s.code))
      .filter((key) => activeSubtypes.has(key))
    return (
      <>
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs text-muted-foreground">
            {RENTAL_OBJECT_GROUP_LABELS[type]}:{' '}
            {chosenKeys.length === 0
              ? 'alla typer'
              : `${chosenKeys.length} av ${options.length}`}
          </span>
          {chosenKeys.length > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => chosenKeys.forEach(onToggleSubtype)}
            >
              Rensa
            </button>
          )}
        </div>
        {options.map((s) => {
          const key = subtypeKey(type, s.code)
          return (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={activeSubtypes.has(key)}
                onCheckedChange={() => onToggleSubtype(key)}
              />
              <span className="truncate">{s.name}</span>
            </label>
          )
        })}
      </>
    )
  }

  // Anchored to the whole group, not the chevron that opened it, so the
  // panel stays in the same place whichever type is picked.
  return (
    <Popover
      open={subtypeMenu !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) setSubtypeMenu(null)
      }}
    >
      <PopoverAnchor asChild>
        <div
          ref={groupRef}
          className="inline-flex divide-x overflow-hidden rounded-md border"
        >
          {ALL_RENTAL_OBJECT_TYPES.map((type) => {
            const TypeIcon = OBJECT_TYPE_ICONS[type]
            const active = activeObjectTypes.has(type)
            const options = subtypesByType.get(type) ?? []
            const chosen = options.filter((s) =>
              activeSubtypes.has(subtypeKey(type, s.code))
            ).length
            return (
              <div key={type} className="inline-flex">
                <button
                  type="button"
                  onClick={() => {
                    // Deactivating a type closes its own open subtype menu.
                    if (active && subtypeMenu === type) setSubtypeMenu(null)
                    onToggleObjectType(type)
                  }}
                  aria-pressed={active}
                  title={RENTAL_OBJECT_GROUP_LABELS[type]}
                  className={
                    active
                      ? 'inline-flex items-center gap-1.5 bg-primary py-1.5 pl-3 pr-2 text-sm font-medium text-primary-foreground transition-colors'
                      : 'inline-flex items-center gap-1.5 bg-background py-1.5 pl-3 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted'
                  }
                >
                  <TypeIcon className="h-4 w-4" />
                  <span className="hidden @2xl:inline">
                    {RENTAL_OBJECT_GROUP_LABELS[type]}
                  </span>
                  {chosen > 0 && (
                    <span className="rounded-full bg-background/25 px-1.5 text-xs">
                      {chosen}
                    </span>
                  )}
                </button>
                {active && options.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSubtypeMenu((current) =>
                        current === type ? null : type
                      )
                    }
                    aria-label={`Välj ${RENTAL_OBJECT_GROUP_LABELS[
                      type
                    ].toLowerCase()}typ`}
                    className={
                      active
                        ? 'bg-primary pr-2 text-primary-foreground'
                        : 'bg-background pr-2 text-muted-foreground'
                    }
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </PopoverAnchor>
      {subtypeMenu && (
        <PopoverContent
          align="start"
          className="max-h-72 w-64 overflow-y-auto p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (groupRef.current?.contains(e.target as Node)) {
              e.preventDefault()
            }
          }}
        >
          {renderSubtypeMenu(subtypeMenu)}
        </PopoverContent>
      )}
    </Popover>
  )
}
