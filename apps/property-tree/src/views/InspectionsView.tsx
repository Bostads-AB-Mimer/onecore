import { useState, useEffect } from 'react'
import { components } from '@/services/api/core/generated/api-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/Popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/Command'
import { ChevronsUpDown, Check, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

import {
  InspectionsTable,
  useInspectionFilters,
  useInspectionSorting,
} from '@/features/inspections'
import { inspectionService } from '@/services/api/core/inspectionService'
import { useQuery } from '@tanstack/react-query'

type Inspection = components['schemas']['Inspection']

export default function AllInspectionsPage() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const inspectionsQuery = useQuery({
    queryKey: ['inspections'],
    queryFn: () => inspectionService.getAllInspections(),
  })

  const [inspections, setInspections] = useState<Inspection[]>([])

  const [selectedInspection, setSelectedInspection] =
    useState<Inspection | null>(null)

  // Update inspections when query data changes
  useEffect(() => {
    if (inspectionsQuery.data) {
      setInspections(inspectionsQuery.data)
    }
  }, [inspectionsQuery.data])

  // Use custom hooks BEFORE conditional returns
  const {
    selectedInspector,
    setSelectedInspector,
    selectedAddress,
    setSelectedAddress,
    selectedDistrict,
    setSelectedDistrict,
    selectedPriority,
    setSelectedPriority,
    openInspectorDropdown,
    setOpenInspectorDropdown,
    openAddressDropdown,
    setOpenAddressDropdown,
    openDistrictDropdown,
    setOpenDistrictDropdown,
    openPriorityDropdown,
    setOpenPriorityDropdown,
    uniqueInspectors,
    uniqueAddresses,
    // uniqueDistricts,
    // priorityOptions,
    filterInspections,
    clearFilters,
    hasActiveFilters,
  } = useInspectionFilters(inspections)

  const { sortInspections } = useInspectionSorting()

  if (inspectionsQuery.isLoading) {
    return <div>Loading inspections...</div>
  }

  if (inspectionsQuery.error) {
    return <div>Error loading inspections</div>
  }

  const ongoingInspections = sortInspections(
    filterInspections(
      inspections.filter((inspection) => inspection.status !== 'Genomförd')
    )
  )
  // const myInspections = sortInspections(
  //   filterInspections(
  //     inspections.filter(
  //       (inspection) =>
  //         inspection.inspector === CURRENT_USER &&
  //         inspection.status !== 'Genomförd'
  //     )
  //   )
  // )
  const myInspections: Inspection[] = []

  const completedInspections = filterInspections(
    inspections.filter((inspection) => inspection.status === 'Genomförd')
  )

  const renderInspectionTable = (
    data: Inspection[],
    title: string,
    isCompleted: boolean = false
  ) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {title}
            <Badge variant="outline">{data.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <InspectionsTable inspections={data} isCompleted={isCompleted} />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Inga besiktningar i denna kategori
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="py-4 animate-in max-w-full overflow-hidden">
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Besiktningar</h1>
            <p className="text-muted-foreground">
              Översikt över alla besiktningar och tilldelningar
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Inspector Filter */}
            <Popover
              open={openInspectorDropdown}
              onOpenChange={setOpenInspectorDropdown}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openInspectorDropdown}
                  className="w-full sm:w-[250px] justify-between"
                >
                  {selectedInspector
                    ? selectedInspector
                    : 'Välj besiktningsman...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[300px] p-0 bg-background z-50"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Sök besiktningsman..." />
                  <CommandList>
                    <CommandEmpty>Ingen besiktningsman hittades.</CommandEmpty>
                    <CommandGroup>
                      {uniqueInspectors.map((inspector) => (
                        <CommandItem
                          key={inspector}
                          value={inspector}
                          onSelect={() => {
                            setSelectedInspector(
                              selectedInspector === inspector ? '' : inspector
                            )
                            setOpenInspectorDropdown(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedInspector === inspector
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {inspector}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Address Filter */}
            <Popover
              open={openAddressDropdown}
              onOpenChange={setOpenAddressDropdown}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openAddressDropdown}
                  className="w-full sm:w-[250px] justify-between"
                >
                  {selectedAddress ? selectedAddress : 'Välj adress...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[300px] p-0 bg-background z-50"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Sök adress..." />
                  <CommandList>
                    <CommandEmpty>Ingen adress hittades.</CommandEmpty>
                    <CommandGroup>
                      {uniqueAddresses.map((address) => (
                        <CommandItem
                          key={address}
                          value={address}
                          onSelect={() => {
                            setSelectedAddress(
                              selectedAddress === address ? '' : address
                            )
                            setOpenAddressDropdown(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedAddress === address
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {address}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* District Filter */}
            {/* <Popover
              open={openDistrictDropdown}
              onOpenChange={setOpenDistrictDropdown}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openDistrictDropdown}
                  className="w-full sm:w-[250px] justify-between"
                >
                  {selectedDistrict ? selectedDistrict : 'Välj distrikt...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[300px] p-0 bg-background z-50"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Sök distrikt..." />
                  <CommandList>
                    <CommandEmpty>Inget distrikt hittades.</CommandEmpty>
                    <CommandGroup>
                      {uniqueDistricts.map((district) => (
                        <CommandItem
                          key={district}
                          value={district}
                          onSelect={() => {
                            setSelectedDistrict(
                              selectedDistrict === district ? '' : district
                            )
                            setOpenDistrictDropdown(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedDistrict === district
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {district}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover> */}

            {/* Priority Filter */}
            {/* <Popover
              open={openPriorityDropdown}
              onOpenChange={setOpenPriorityDropdown}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openPriorityDropdown}
                  className="w-full sm:w-[250px] justify-between"
                >
                  {selectedPriority
                    ? priorityOptions.find((p) => p.value === selectedPriority)
                        ?.label
                    : 'Välj prioritet...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[300px] p-0 bg-background z-50"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Sök prioritet..." />
                  <CommandList>
                    <CommandEmpty>Ingen prioritet hittades.</CommandEmpty>
                    <CommandGroup>
                      {priorityOptions.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => {
                            setSelectedPriority(
                              selectedPriority === option.value
                                ? ''
                                : option.value
                            )
                            setOpenPriorityDropdown(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedPriority === option.value
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover> */}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Rensa filter
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="ongoing" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ongoing">
              Pågående ({ongoingInspections.length})
            </TabsTrigger>
            <TabsTrigger value="mine">
              Mina besiktningar ({myInspections.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Avslutade ({completedInspections.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ongoing" className="space-y-4">
            {renderInspectionTable(
              ongoingInspections,
              'Alla pågående registrerade besiktningar'
            )}
          </TabsContent>

          <TabsContent value="mine" className="space-y-4">
            {renderInspectionTable(myInspections, 'Mina besiktningar')}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {renderInspectionTable(
              completedInspections,
              'Skickade/avslutade besiktningar',
              true
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* <Dialog
        open={selectedInspection !== null}
        onOpenChange={(open: boolean) => !open && setSelectedInspection(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedInspection && (
            <InspectionProtocol
              inspection={selectedInspection}
              onClose={() => setSelectedInspection(null)}
            />
          )}
        </DialogContent>
      </Dialog> */}
    </div>
  )
}
