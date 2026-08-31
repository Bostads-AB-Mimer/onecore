import { useState } from 'react'
import { Plus, X } from 'lucide-react'

import type { components } from '@/services/api/core/generated/api-types'

import { Button } from '@/shared/ui/Button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/Command'
import { Input } from '@/shared/ui/Input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/Popover'

import { DETAIL_COMPONENT_OPTIONS } from '../constants'
import { CONDITION_OPTIONS, CONDITION_TYPE } from '../constants/conditions'
import {
  COST_RESPONSIBILITY,
  type CostResponsibility,
} from '../constants/costResponsibility'
import { CostResponsibilitySelect } from './CostResponsibilitySelect'

type DetailComponent = NonNullable<
  components['schemas']['InspectionRoom']['detailComponents']
>[number]

interface DetailComponentsSectionProps {
  detailComponents: DetailComponent[]
  onAdd: (component: { type: string; label: string }) => void
  onRemove: (componentId: string) => void
  onNoteUpdate: (componentId: string, note: string) => void
  onConditionUpdate: (componentId: string, value: string) => void
  onCostUpdate: (componentId: string, cost: number) => void
  onCostResponsibilityUpdate: (
    componentId: string,
    value: CostResponsibility
  ) => void
}

export function DetailComponentsSection({
  detailComponents,
  onAdd,
  onRemove,
  onNoteUpdate,
  onConditionUpdate,
  onCostUpdate,
  onCostResponsibilityUpdate,
}: DetailComponentsSectionProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Filter out already added types, but allow 'custom' to be added multiple times
  const addedTypes = new Set(
    detailComponents.filter((c) => c.type !== 'custom').map((c) => c.type)
  )
  const availableOptions = DETAIL_COMPONENT_OPTIONS.filter(
    (opt) => !addedTypes.has(opt.type)
  )

  // Show "add custom" when search text doesn't match any available option
  const trimmedSearch = search.trim()
  const hasExactMatch = availableOptions.some(
    (opt) => opt.label.toLowerCase() === trimmedSearch.toLowerCase()
  )
  const showCustomOption = trimmedSearch.length > 0 && !hasExactMatch

  const handleSelect = (option: { type: string; label: string }) => {
    onAdd(option)
    setSearch('')
    setOpen(false)
  }

  const handleAddCustom = () => {
    onAdd({ type: 'custom', label: trimmedSearch })
    setSearch('')
    setOpen(false)
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-muted-foreground">
        Detaljer
        {detailComponents.length > 0 && ` (${detailComponents.length})`}
      </h4>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start font-normal hover:bg-primary hover:text-primary-foreground hover:border-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Lägg till detalj...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command shouldFilter={true}>
            <CommandInput
              placeholder="Sök eller skriv egen detalj..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[400px]">
              <CommandEmpty>
                {trimmedSearch.length > 0 ? (
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 text-sm text-left hover:bg-primary hover:text-primary-foreground rounded-sm cursor-default"
                    onClick={handleAddCustom}
                  >
                    Lägg till &quot;{trimmedSearch}&quot;
                  </button>
                ) : (
                  'Inga detaljer hittades.'
                )}
              </CommandEmpty>
              <CommandGroup>
                {availableOptions.map((option) => (
                  <CommandItem
                    key={option.type}
                    value={option.label}
                    onSelect={() => handleSelect(option)}
                    className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                  >
                    {option.label}
                  </CommandItem>
                ))}
                {showCustomOption && (
                  <CommandItem
                    value={`custom-${trimmedSearch}`}
                    onSelect={handleAddCustom}
                    className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                  >
                    Lägg till &quot;{trimmedSearch}&quot;
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {detailComponents.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          {detailComponents.map((comp, index) => {
            const condition = comp.condition ?? ''
            const isDamaged = condition === CONDITION_TYPE.DAMAGED
            const costResponsibility = comp.costResponsibility ?? null
            const showCostInput =
              isDamaged && costResponsibility !== COST_RESPONSIBILITY.LANDLORD
            return (
              <div
                key={comp.id}
                className={`px-3 py-3 space-y-2 ${
                  index < detailComponents.length - 1
                    ? 'border-b border-border'
                    : ''
                }`}
              >
                <div className="grid grid-cols-[1fr_36px] items-center">
                  <span className="text-sm font-medium">{comp.label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(comp.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Condition buttons — same three-column grid as ComponentInspectionCard */}
                <div className="grid grid-cols-3 gap-2">
                  {CONDITION_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={
                        condition === option.value ? 'default' : 'outline'
                      }
                      size="sm"
                      className={`h-9 text-sm font-medium ${
                        condition === option.value ? option.buttonClassName : ''
                      }`}
                      onClick={() => onConditionUpdate(comp.id, option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                {/* Cost responsibility + cost — only shown for Skadad */}
                {isDamaged && (
                  <div className="grid grid-cols-2 gap-2">
                    <CostResponsibilitySelect
                      value={costResponsibility}
                      onChange={(value) =>
                        onCostResponsibilityUpdate(comp.id, value)
                      }
                      ariaLabel={`Kostnadsansvar för ${comp.label}`}
                    />
                    {showCostInput && (
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={(comp.cost ?? 0) === 0 ? '' : comp.cost}
                        placeholder="Kostnad (kr)"
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const raw = e.target.value
                          const cost =
                            raw === ''
                              ? 0
                              : Math.max(0, Math.trunc(Number(raw) || 0))
                          onCostUpdate(comp.id, cost)
                        }}
                        aria-label={`Kostnad för ${comp.label}`}
                        className="h-9"
                      />
                    )}
                  </div>
                )}

                <Input
                  placeholder="Anteckning..."
                  value={comp.note || ''}
                  onChange={(e) => onNoteUpdate(comp.id, e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
