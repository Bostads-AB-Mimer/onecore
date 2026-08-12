import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'

import { RENTAL_OBJECT_GROUP_LABELS } from '../hooks/useOccupantData'
import {
  AUDIENCE_LEVEL_LABELS,
  AUDIENCE_LEVEL_PLURAL_LABELS,
  audienceValueLabel,
} from '../model/labels'
import type { AudienceLevel, AudienceObjectType } from '../model/selection'

/** A tree-level criterion, or the object-type filter ('objectType'). */
export type AudienceChipLevel = AudienceLevel | 'objectType'

export interface AudienceChipItem {
  level: AudienceChipLevel
  value: string
}

interface AudienceCriteriaChipsProps {
  items: AudienceChipItem[]
  onRemove: (level: AudienceChipLevel, value: string) => void
  /** Remove every chip of one level (the collapsed group chip's ✕). */
  onRemoveLevel: (level: AudienceChipLevel, values: string[]) => void
}

/** Levels with more chips than this collapse into one expandable group chip. */
const GROUP_THRESHOLD = 5

const chipPrefix = (level: AudienceChipLevel): string | null =>
  level === 'district'
    ? null
    : level === 'objectType'
      ? 'Objekttyp'
      : AUDIENCE_LEVEL_LABELS[level]

const chipLabel = (level: AudienceChipLevel, value: string): string =>
  level === 'objectType'
    ? (RENTAL_OBJECT_GROUP_LABELS[value as AudienceObjectType] ?? value)
    : audienceValueLabel(level, value)

const groupLabel = (level: AudienceChipLevel): string =>
  level === 'objectType' ? 'Objekttyper' : AUDIENCE_LEVEL_PLURAL_LABELS[level]

const chipClass =
  'inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium'

function Chip({
  level,
  value,
  onRemove,
}: {
  level: AudienceChipLevel
  value: string
  onRemove: (level: AudienceChipLevel, value: string) => void
}) {
  return (
    <span className={chipClass}>
      {chipPrefix(level) && (
        <span className="text-muted-foreground">{chipPrefix(level)}:</span>
      )}
      {chipLabel(level, value)}
      <button
        type="button"
        onClick={() => onRemove(level, value)}
        className="text-muted-foreground hover:text-foreground"
        aria-label={`Ta bort ${chipLabel(level, value)}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

/** Removable chips for the active audience criteria in the filter bar.
 * Levels with many values collapse into one expandable group chip. */
export function AudienceCriteriaChips({
  items,
  onRemove,
  onRemoveLevel,
}: AudienceCriteriaChipsProps) {
  const [expandedLevels, setExpandedLevels] = useState<
    ReadonlySet<AudienceChipLevel>
  >(new Set())

  if (items.length === 0) return null

  const groups = new Map<AudienceChipLevel, string[]>()
  for (const { level, value } of items) {
    const list = groups.get(level) ?? []
    list.push(value)
    groups.set(level, list)
  }

  const toggleLevel = (level: AudienceChipLevel) =>
    setExpandedLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })

  return (
    <div className="flex flex-wrap gap-2">
      {[...groups.entries()].map(([level, values]) => {
        if (values.length <= GROUP_THRESHOLD) {
          return values.map((value) => (
            <Chip
              key={`${level}:${value}`}
              level={level}
              value={value}
              onRemove={onRemove}
            />
          ))
        }
        if (!expandedLevels.has(level)) {
          return (
            <span key={`grp:${level}`} className={chipClass}>
              <button
                type="button"
                onClick={() => toggleLevel(level)}
                className="inline-flex items-center gap-1 hover:text-primary"
                aria-label={`Visa alla ${groupLabel(level).toLowerCase()}`}
              >
                {groupLabel(level)} ({values.length})
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onRemoveLevel(level, values)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Ta bort alla ${groupLabel(level).toLowerCase()}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )
        }
        return (
          <span key={`grp:${level}`} className="contents">
            {values.map((value) => (
              <Chip
                key={`${level}:${value}`}
                level={level}
                value={value}
                onRemove={onRemove}
              />
            ))}
            <button
              type="button"
              onClick={() => toggleLevel(level)}
              className={`${chipClass} hover:text-primary`}
            >
              Visa färre
              <ChevronUp className="h-3 w-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}
