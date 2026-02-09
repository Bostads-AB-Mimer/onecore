import { useState } from 'react'
import { ChevronsUpDown, Check, X } from 'lucide-react'

import { components } from '@/services/api/core/generated/api-types'
import { useInspectionFilters } from '@/features/inspections/hooks/useInspectionFilters'
import { useInspections } from '@/features/inspections/hooks/useInspections'
import { INSPECTION_STATUS_FILTER } from '@/features/inspections/constants/inspectionTypes'
import { InspectionsTable } from '@/features/inspections'
import { useUrlPagination } from '@/shared/hooks'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/Command'
import { ViewLayout } from '@/shared/ui/layout'
import { Pagination } from '@/shared/ui/Pagination'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/Popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/Tabs'

type Inspection = components['schemas']['Inspection']

export default function InspectionsPage() {
  const [activeTab, setActiveTab] = useState<string>(
    INSPECTION_STATUS_FILTER.ONGOING
  )

  const {
    page: ongoingPage,
    setPage: setOngoingPage,
    limit,
  } = useUrlPagination({ defaultLimit: 25 })

  const [completedPage, setCompletedPage] = useState(1)

  // Filter state needs to be initialized before queries so we can pass filter
  // values as server-side query params. The dropdown options are derived from
  // whichever tab's data is currently visible (populated after the queries run).
  const [selectedInspector, setSelectedInspectorRaw] = useState('')
  const [selectedAddress, setSelectedAddressRaw] = useState('')

  const ongoingQuery = useInspections(
    INSPECTION_STATUS_FILTER.ONGOING,
    ongoingPage,
    limit,
    selectedInspector,
    selectedAddress
  )
  const completedQuery = useInspections(
    INSPECTION_STATUS_FILTER.COMPLETED,
    completedPage,
    limit,
    selectedInspector,
    selectedAddress
  )

  const ongoingInspections = ongoingQuery.data ?? []
  const completedInspections = completedQuery.data ?? []

  const currentInspections =
    activeTab === INSPECTION_STATUS_FILTER.COMPLETED
      ? completedInspections
      : ongoingInspections

  const {
    openInspectorDropdown,
    setOpenInspectorDropdown,
    openAddressDropdown,
    setOpenAddressDropdown,
    uniqueInspectors,
    uniqueAddresses,
  } = useInspectionFilters(currentInspections)

  // Wrap filter setters to reset page to 1 when filters change
  const setSelectedInspector = (value: string) => {
    setSelectedInspectorRaw(value)
    setOngoingPage(1)
    setCompletedPage(1)
  }

  const setSelectedAddress = (value: string) => {
    setSelectedAddressRaw(value)
    setOngoingPage(1)
    setCompletedPage(1)
  }

  const clearFilters = () => {
    setSelectedInspectorRaw('')
    setSelectedAddressRaw('')
    setOngoingPage(1)
    setCompletedPage(1)
  }

  const myInspections: Inspection[] = []

  const ongoingTotalRecords = ongoingQuery.meta?.totalRecords ?? 0
  const completedTotalRecords = completedQuery.meta?.totalRecords ?? 0

  const isLoading = ongoingQuery.isLoading && completedQuery.isLoading

  if (isLoading) {
    return <div>Loading inspections...</div>
  }

  if (ongoingQuery.error && completedQuery.error) {
    return <div>Error loading inspections</div>
  }

  const ongoingTotalPages = Math.ceil(ongoingTotalRecords / limit)
  const completedTotalPages = Math.ceil(completedTotalRecords / limit)

  return (
    <ViewLayout>
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

            {(selectedInspector || selectedAddress) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Rensa filter
              </Button>
            )}
          </div>
        </div>

        <Tabs
          defaultValue={INSPECTION_STATUS_FILTER.ONGOING}
          className="space-y-6"
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value={INSPECTION_STATUS_FILTER.ONGOING}>
              Pågående ({ongoingTotalRecords})
            </TabsTrigger>
            <TabsTrigger value="mine">
              Mina besiktningar ({myInspections.length})
            </TabsTrigger>
            <TabsTrigger value={INSPECTION_STATUS_FILTER.COMPLETED}>
              Avslutade ({completedTotalRecords})
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value={INSPECTION_STATUS_FILTER.ONGOING}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Alla pågående registrerade besiktningar
                  <Badge variant="outline">{ongoingTotalRecords}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ongoingQuery.isLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Laddar besiktningar...
                    </p>
                  </div>
                ) : ongoingInspections.length > 0 ? (
                  <InspectionsTable inspections={ongoingInspections} />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Inga besiktningar i denna kategori
                    </p>
                  </div>
                )}
                <Pagination
                  currentPage={ongoingPage}
                  totalPages={ongoingTotalPages}
                  totalRecords={ongoingTotalRecords}
                  pageSize={limit}
                  onPageChange={setOngoingPage}
                  isFetching={ongoingQuery.isFetching}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mine" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Mina besiktningar
                  <Badge variant="outline">{myInspections.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Inga besiktningar i denna kategori
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value={INSPECTION_STATUS_FILTER.COMPLETED}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Skickade/avslutade besiktningar
                  <Badge variant="outline">{completedTotalRecords}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedQuery.isLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Laddar besiktningar...
                    </p>
                  </div>
                ) : completedInspections.length > 0 ? (
                  <InspectionsTable
                    inspections={completedInspections}
                    isCompleted
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Inga besiktningar i denna kategori
                    </p>
                  </div>
                )}
                <Pagination
                  currentPage={completedPage}
                  totalPages={completedTotalPages}
                  totalRecords={completedTotalRecords}
                  pageSize={limit}
                  onPageChange={setCompletedPage}
                  isFetching={completedQuery.isFetching}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ViewLayout>
  )
}
