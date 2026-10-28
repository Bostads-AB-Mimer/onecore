import { useEffect, useId, useState } from 'react'
import type { property } from '@onecore/types'

import { Input } from '@/shared/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

import {
  allowsInstalledBefore,
  type ComponentFilterControl,
  parseInstalledBeforeYear,
} from '../lib/libraryUrlState'

const ALL = 'all'

const INSTALLATION_OPTIONS: {
  value: property.ComponentInstallationFilter | typeof ALL
  label: string
}[] = [
  { value: ALL, label: 'Alla installationer' },
  { value: 'installed', label: 'Installerade' },
  { value: 'notInstalled', label: 'Ej installerade' },
  { value: 'unknownDate', label: 'Okänt installationsdatum' },
]

export const InstallationFilter = ({
  filters,
}: {
  filters: ComponentFilterControl
}) => {
  const id = useId()
  return (
    <div className="w-full sm:w-56">
      <label htmlFor={id} className="sr-only">
        Filtrera på installation
      </label>
      <Select
        value={filters.value.installation ?? ALL}
        onValueChange={(value) =>
          filters.onInstallationChange(
            value === ALL
              ? undefined
              : (value as property.ComponentInstallationFilter)
          )
        }
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INSTALLATION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export const InstalledBeforeFilter = ({
  filters,
}: {
  filters: ComponentFilterControl
}) => {
  const id = useId()
  const year = filters.value.installedBefore
  const [text, setText] = useState(year ? String(year) : '')

  // Keep half-typed text; replace it only when the URL's year changes elsewhere.
  useEffect(() => {
    setText((current) =>
      parseInstalledBeforeYear(current) === year
        ? current
        : year
          ? String(year)
          : ''
    )
  }, [year])

  if (!allowsInstalledBefore(filters.value.installation)) return null

  const parsed = parseInstalledBeforeYear(text)
  const isInvalid = text.trim().length === 4 && parsed === undefined

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className="whitespace-nowrap text-sm text-muted-foreground"
      >
        Installerad före
      </label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        placeholder="År"
        value={text}
        aria-invalid={isInvalid || undefined}
        aria-describedby={isInvalid ? `${id}-error` : undefined}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          const nextYear = parseInstalledBeforeYear(next)
          if (nextYear !== year) filters.onInstalledBeforeChange(nextYear)
        }}
        className="h-10 w-20 tabular-nums aria-[invalid=true]:border-destructive"
      />
      {isInvalid && (
        <span id={`${id}-error`} className="text-sm text-destructive">
          Ange ett år efter 1901
        </span>
      )}
    </div>
  )
}
