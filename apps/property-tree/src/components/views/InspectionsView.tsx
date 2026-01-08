import { useState, useEffect } from 'react'
import { ExternalInspection } from '../../services/api/core/inspectionService'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { Badge } from '@/components/ui/v2/Badge'
import { Button } from '@/components/ui/v2/Button'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v2/Tabs'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/Command'
import {
  Eye,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Check,
  X,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/v2/Dialog'
import { InspectionReadOnly } from '@/components/residence/inspection/InspectionReadOnly'
import { cn } from '@/lib/utils'
import { InspectionsHeader } from '@/components/inspections/InspectionsHeader'
import { InspectorCell } from '@/components/inspections/InspectorCell'
import { DateCell } from '@/components/inspections/DateCell'
// import { SortableHeader } from './components/SortableHeader' Unused?
import { useInspectionFilters } from '@/components/hooks/useInspectionFilters'
import { useInspectionSorting } from '@/components/hooks/useInspectionSorting'
// temp mock data TODO replace with real data when available
import { inspectionService } from '@/services/api/core/inspectionService'
import {
  getAllInspections,
  CURRENT_USER,
} from '@/components/inspections/mockdata/mockInspections'
import { useQuery } from '@tanstack/react-query'

export default function AllInspectionsPage() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const inspectionsQuery = useQuery({
    queryKey: ['inspections'],
    queryFn: () => inspectionService.getAllInspections(),
  })

  const [inspections, setInspections] = useState<ExternalInspection[]>([])

  const [selectedInspection, setSelectedInspection] =
    useState<ExternalInspection | null>(null)

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

  const { sortField, sortDirection, handleSort, sortInspections } =
    useInspectionSorting()

  if (inspectionsQuery.isLoading) {
    return <div>Loading inspections...</div>
  }

  if (inspectionsQuery.error) {
    return <div>Error loading inspections</div>
  }

  const handleViewInspection = (inspection: ExternalInspection) => {
    setSelectedInspection(inspection)
  }

  // Update inspection data
  const updateInspection = (
    id: string,
    updates: Partial<ExternalInspection>
  ) => {
    setInspections((prev) =>
      prev.map((inspection) =>
        inspection.id === id ? { ...inspection, ...updates } : inspection
      )
    )
  }

  // const getStatusBadge = (inspection: ExternalInspection) => {
  //   if (inspection.isCompleted) {
  //     return 'Slutförd'
  //   }
  //   return 'Pågående'
  // }

  // const getPriorityBadge = (priority: 'avflytt' | 'inflytt') => {
  //   return priority === 'avflytt' ? 'Avflytt' : 'Inflytt'
  // }

  // const getCompletedRoomsCount = (inspection: ExternalInspection) => {
  //   if (!inspection.rooms) return 0
  //   return Object.values(inspection.rooms).filter((room) => room.isHandled)
  //     .length
  // }

  // const getTotalRoomsCount = (inspection: ExternalInspection) => {
  //   if (!inspection.rooms) return 0
  //   return Object.keys(inspection.rooms).length
  // }

  // Filter inspections by category and apply filters
  const ongoingInspections = sortInspections(
    filterInspections(
      inspections.filter((inspection) => inspection.status !== 'Genomförd')
    )
  )
  const myInspections = sortInspections(
    filterInspections(
      inspections.filter(
        (inspection) =>
          inspection.inspector === CURRENT_USER &&
          inspection.status !== 'Genomförd'
      )
    )
  )
  const completedInspections = filterInspections(
    inspections.filter((inspection) => inspection.status === 'Genomförd')
  )

  const renderInspectionTable = (
    data: ExternalInspection[],
    title: string,
    isCompleted: boolean = false
  ) => {
    // Skapa kolumner dynamiskt baserat på om det är avslutade besiktningar
    const columns = [
      {
        key: 'inspector',
        label: 'Tilldelad',
        render: (inspection: ExternalInspection) => (
          <InspectorCell
            inspection={inspection}
            readOnly={isCompleted}
            onUpdate={updateInspection}
          />
        ),
      },
      {
        key: 'type',
        label: 'Typ',
        hideOnMobile: true,
        render: (inspection: ExternalInspection) => (
          <span className="text-sm">{inspection.type || 'N/A'}</span>
        ),
      },
      // {
      //   key: 'priority',
      //   label: 'Prioritet',
      //   hideOnMobile: true,
      //   render: (inspection: ExternalInspection) => (
      //     <div className="flex items-center gap-2">
      //       <span>{getPriorityBadge(inspection.priority || 'inflytt')}</span>
      //       <Button
      //         variant="ghost"
      //         size="sm"
      //         className="h-6 w-6 p-0"
      //         onClick={() => handleSort('priority')}
      //       >
      //         {sortField === 'priority' &&
      //           (sortDirection === 'asc' ? (
      //             <ChevronUp className="h-3 w-3" />
      //           ) : (
      //             <ChevronDown className="h-3 w-3" />
      //           ))}
      //       </Button>
      //     </div>
      //   ),
      // },
      {
        key: 'leaseId',
        label: 'Kontrakt ID',
        hideOnMobile: true,
        render: (inspection: ExternalInspection) => (
          <div className="flex items-center gap-2">
            <span>{inspection.leaseId || 'N/A'}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => handleSort('leaseId')}
            >
              {sortField === 'leaseId' &&
                (sortDirection === 'asc' ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                ))}
            </Button>
          </div>
        ),
      },
      {
        key: 'address',
        label: 'Adress',
        render: (inspection: ExternalInspection) => inspection.address || 'N/A',
      },
      // {
      //   key: 'tenantPhone',
      //   label: 'Telefonnummer',
      //   hideOnMobile: true,
      //   render: (inspection: ExternalInspection) =>
      //     inspection.tenantPhone || 'N/A',
      // },
      // {
      //   key: 'masterKey',
      //   label: 'Huvudnyckel',
      //   render: (inspection: ExternalInspection) =>
      //     inspection.masterKey ? 'Ja' : 'Nej',
      // },
      // {
      //   key: 'terminationDate',
      //   label: 'Uppsägning',
      //   hideOnMobile: true,
      //   render: (inspection: ExternalInspection) => (
      //     <span className="whitespace-nowrap">
      //       {inspection.terminationDate || 'N/A'}
      //     </span>
      //   ),
      // },
      {
        key: 'date',
        label: isCompleted ? 'Utfört' : 'Planerat datum/tid',
        render: (inspection: ExternalInspection) => (
          <DateCell
            inspection={inspection}
            readOnly={isCompleted}
            onUpdate={updateInspection}
          />
        ),
      },
      // {
      //   key: 'district',
      //   label: 'Distrikt',
      //   hideOnMobile: true,
      //   render: (inspection: ExternalInspection) =>
      //     inspection.district || 'N/A',
      // },
      {
        key: 'id',
        label: 'Besiktningsnummer',
        hideOnMobile: true,
        render: (inspection: ExternalInspection) => inspection.id || 'N/A',
      },
      {
        key: 'status',
        label: 'Status',
        render: (inspection: ExternalInspection) => (
          <Badge
            variant={
              inspection.status === 'Genomförd' ? 'default' : 'secondary'
            }
          >
            {inspection.status || 'Okänd'}
          </Badge>
        ),
      },
      // {
      //   key: 'actions',
      //   label: 'Åtgärder',
      //   render: (inspection: ExternalInspection) => (
      //     <Button
      //       variant="ghost"
      //       size="sm"
      //       onClick={() => handleViewInspection(inspection)}
      //     >
      //       <Eye className="h-4 w-4 mr-1" />
      //       Visa detaljer
      //     </Button>
      //   ),
      // },
    ]

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
            <ResponsiveTable
              data={data}
              columns={columns}
              keyExtractor={(inspection: ExternalInspection) => inspection.id}
              emptyMessage="Inga besiktningar registrerade ännu"
            />
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
        <InspectionsHeader />

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
            <InspectionReadOnly
              inspection={selectedInspection}
              onClose={() => setSelectedInspection(null)}
            />
          )}
        </DialogContent>
      </Dialog> */}
    </div>
  )
}
