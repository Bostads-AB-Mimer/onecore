import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'

import { useIsMobile } from '@/shared/hooks/useMobile'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu'
import { Input } from '@/shared/ui/Input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/Sheet'

export interface ObjectTypeOption {
  label: string
  value: string
}

export interface ParkingSpaceTypeOption {
  code: string
  caption: string
}

interface ObjectTypeFilterProps {
  objectTypeOptions: ObjectTypeOption[]
  selectedObjectTypes: string[]
  onObjectTypeChange: (values: string[]) => void
  /** Which objectType value triggers the parking subtype expansion (e.g. 'parkering') */
  parkingOptionValue: string
  loadParkingSpaceTypes: () => Promise<ParkingSpaceTypeOption[]>
  selectedParkingSpaceTypes: string[]
  onParkingSpaceTypeChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

export function ObjectTypeFilter({
  objectTypeOptions,
  selectedObjectTypes,
  onObjectTypeChange,
  parkingOptionValue,
  loadParkingSpaceTypes,
  selectedParkingSpaceTypes,
  onParkingSpaceTypeChange,
  placeholder = 'Objekttyp',
  className,
}: ObjectTypeFilterProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [parkingSpaceTypes, setParkingSpaceTypes] = useState<
    ParkingSpaceTypeOption[]
  >([])
  const [drillLevel, setDrillLevel] = useState<'root' | 'parking'>('root')
  const [subSearchQuery, setSubSearchQuery] = useState('')

  const filteredParkingSpaceTypes = useMemo(() => {
    if (!subSearchQuery) return parkingSpaceTypes
    const q = subSearchQuery.toLowerCase()
    return parkingSpaceTypes.filter((pt) =>
      pt.caption.toLowerCase().includes(q)
    )
  }, [parkingSpaceTypes, subSearchQuery])

  const totalActive =
    selectedObjectTypes.length + selectedParkingSpaceTypes.length
  const hasActiveFilter = totalActive > 0

  // Lazy-load parking space types when the dropdown/sheet is first opened
  useEffect(() => {
    if (!open || parkingSpaceTypes.length > 0) return
    let cancelled = false
    loadParkingSpaceTypes().then((types) => {
      if (!cancelled) setParkingSpaceTypes(types)
    })
    return () => {
      cancelled = true
    }
  }, [open, parkingSpaceTypes.length, loadParkingSpaceTypes])

  // Reset drill level and sub-search when menu/sheet closes
  useEffect(() => {
    if (!open) {
      setDrillLevel('root')
      setSubSearchQuery('')
    }
  }, [open])

  const buttonText = useMemo(() => {
    if (totalActive === 0) return placeholder
    if (totalActive === 1 && selectedObjectTypes.length === 1) {
      return (
        objectTypeOptions.find((o) => o.value === selectedObjectTypes[0])
          ?.label ?? selectedObjectTypes[0]
      )
    }
    if (totalActive === 1 && selectedParkingSpaceTypes.length === 1) {
      return (
        parkingSpaceTypes.find((pt) => pt.code === selectedParkingSpaceTypes[0])
          ?.caption ?? placeholder
      )
    }
    return `${placeholder} +${totalActive}`
  }, [
    totalActive,
    placeholder,
    selectedObjectTypes,
    selectedParkingSpaceTypes,
    objectTypeOptions,
    parkingSpaceTypes,
  ])

  const toggleObjectType = (value: string, checked: boolean) => {
    if (checked) {
      onObjectTypeChange([...selectedObjectTypes, value])
      // Checking Bilplats ("all parking") clears any specific subtype selections
      if (
        value === parkingOptionValue &&
        selectedParkingSpaceTypes.length > 0
      ) {
        onParkingSpaceTypeChange([])
      }
    } else {
      onObjectTypeChange(selectedObjectTypes.filter((v) => v !== value))
    }
  }

  const toggleParkingSpaceType = (code: string, checked: boolean) => {
    if (checked) {
      onParkingSpaceTypeChange([...selectedParkingSpaceTypes, code])
      // Checking a specific subtype clears the "all parking" parent selection
      if (selectedObjectTypes.includes(parkingOptionValue)) {
        onObjectTypeChange(
          selectedObjectTypes.filter((v) => v !== parkingOptionValue)
        )
      }
    } else {
      onParkingSpaceTypeChange(
        selectedParkingSpaceTypes.filter((c) => c !== code)
      )
    }
  }

  const clearAll = () => {
    onObjectTypeChange([])
    onParkingSpaceTypeChange([])
  }

  const triggerButton = (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'h-9 min-w-[130px] px-3 font-semibold justify-between',
        hasActiveFilter && 'text-primary border-primary',
        className
      )}
    >
      <span className="truncate max-w-[150px]">{buttonText}</span>
      <Filter
        className={cn(
          'h-3 w-3 ml-2 shrink-0',
          hasActiveFilter && 'fill-current'
        )}
      />
    </Button>
  )

  // ===== Mobile path: bottom Sheet with drill-down =====
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="appearance-none bg-transparent border-0 p-0"
        >
          {triggerButton}
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] overflow-y-auto p-0"
          >
            {drillLevel === 'root' ? (
              <div className="p-6 pb-4">
                <SheetHeader className="mb-4">
                  <SheetTitle>{placeholder}</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col">
                  {objectTypeOptions.map((option) => {
                    const isParking = option.value === parkingOptionValue
                    const checked = selectedObjectTypes.includes(option.value)
                    return (
                      <div
                        key={option.value}
                        className="flex items-center gap-3 min-h-[44px] border-b last:border-b-0"
                      >
                        <label className="flex items-center gap-3 flex-1 py-2 cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) =>
                              toggleObjectType(option.value, c === true)
                            }
                          />
                          <span className="text-base">{option.label}</span>
                          {isParking &&
                            selectedParkingSpaceTypes.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                +{selectedParkingSpaceTypes.length}
                              </span>
                            )}
                        </label>
                        {isParking && (
                          <button
                            type="button"
                            onClick={() => setDrillLevel('parking')}
                            className="flex items-center justify-center h-11 w-11 text-muted-foreground"
                            aria-label="Visa bilplatstyper"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {hasActiveFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="mt-4 w-full justify-start"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Rensa filter
                  </Button>
                )}
                <Button className="mt-4 w-full" onClick={() => setOpen(false)}>
                  Klar
                </Button>
              </div>
            ) : (
              <div className="p-6 pb-4">
                <SheetHeader className="mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDrillLevel('root')}
                      className="flex items-center justify-center h-11 w-11 -ml-3 text-muted-foreground"
                      aria-label="Tillbaka"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <SheetTitle>Bilplatstyper</SheetTitle>
                  </div>
                </SheetHeader>
                <div className="mb-3">
                  <Input
                    value={subSearchQuery}
                    onChange={(e) => setSubSearchQuery(e.target.value)}
                    placeholder="Sök bilplatstyp"
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col">
                  {parkingSpaceTypes.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      Laddar...
                    </div>
                  ) : filteredParkingSpaceTypes.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      Inga resultat
                    </div>
                  ) : (
                    filteredParkingSpaceTypes.map((pt) => {
                      const checked = selectedParkingSpaceTypes.includes(
                        pt.code
                      )
                      return (
                        <label
                          key={pt.code}
                          className="flex items-center gap-3 min-h-[44px] py-2 cursor-pointer border-b last:border-b-0"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) =>
                              toggleParkingSpaceType(pt.code, c === true)
                            }
                          />
                          <span className="text-base">{pt.caption}</span>
                        </label>
                      )
                    })
                  )}
                </div>
                <Button
                  className="mt-4 w-full"
                  onClick={() => setDrillLevel('root')}
                >
                  Klar
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  // ===== Desktop path: Radix DropdownMenu with SubMenu =====
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {objectTypeOptions.map((option) => {
          const isParking = option.value === parkingOptionValue
          const checked = selectedObjectTypes.includes(option.value)

          if (!isParking) {
            return (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={checked}
                onCheckedChange={(c) =>
                  toggleObjectType(option.value, c === true)
                }
                onSelect={(e) => e.preventDefault()}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            )
          }

          // Parking row: render checkbox + Sub for the chevron/submenu
          return (
            <DropdownMenuSub key={option.value}>
              <DropdownMenuSubTrigger className="pl-2 pr-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) =>
                    toggleObjectType(option.value, c === true)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="ml-2">{option.label}</span>
                {selectedParkingSpaceTypes.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    +{selectedParkingSpaceTypes.length}
                  </span>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-72">
                <div className="p-2 pb-1">
                  <Input
                    value={subSearchQuery}
                    onChange={(e) => setSubSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Sök bilplatstyp"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {parkingSpaceTypes.length === 0 ? (
                    <div className="py-2 px-3 text-xs text-muted-foreground">
                      Laddar...
                    </div>
                  ) : filteredParkingSpaceTypes.length === 0 ? (
                    <div className="py-2 px-3 text-xs text-muted-foreground">
                      Inga resultat
                    </div>
                  ) : (
                    filteredParkingSpaceTypes.map((pt) => (
                      <DropdownMenuCheckboxItem
                        key={pt.code}
                        checked={selectedParkingSpaceTypes.includes(pt.code)}
                        onCheckedChange={(c) =>
                          toggleParkingSpaceType(pt.code, c === true)
                        }
                        onSelect={(e) => e.preventDefault()}
                      >
                        {pt.caption}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        })}

        {hasActiveFilter && (
          <>
            <DropdownMenuSeparator />
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 justify-start px-2 text-xs"
              onClick={clearAll}
            >
              <X className="h-3 w-3 mr-1" />
              Rensa filter
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
