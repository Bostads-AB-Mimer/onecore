import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmptyState,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Upload, FileText } from 'lucide-react'
import {
  KeySystem,
  Property,
  type Key,
  getKeySystemTypeFilterOptions,
  getKeySystemStatusFilterOptions,
} from '@/services/types'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import React, { useState } from 'react'
import { NotePopover } from '@/components/shared/tables/NotePopover'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { DateRangeFilterDropdown } from '@/components/ui/date-range-filter-dropdown'
import { ExpandButton } from '@/components/shared/tables/ExpandButton'
import { FilterableTableHeader } from '@/components/shared/tables/FilterableTableHeader'
import { ActionMenu } from '@/components/shared/tables/ActionMenu'
import { ExpandedRowFreeContent } from '@/components/shared/tables/ExpandedRowFreeContent'
import { KeysListSectioned } from '@/components/shared/tables/KeysListSectioned'
import { KeySystemTypeBadge } from '@/components/shared/tables/StatusBadges'

interface KeySystemsTableProps {
  KeySystems: KeySystem[]
  propertyMap: Map<string, Property>
  onEdit: (KeySystem: KeySystem) => void
  onDelete: (id: string) => void
  onExplore: (KeySystem: KeySystem) => void
  expandedSystemId: string | null
  onToggleExpand: (systemId: string) => void
  keysForExpandedSystem: Key[]
  isLoadingKeys: boolean
  selectedType: string | null
  onTypeFilterChange: (value: string | null) => void
  selectedStatus: string | null
  onStatusFilterChange: (value: string | null) => void
  installationDateAfter: string | null
  installationDateBefore: string | null
  onDatesChange: (afterDate: string | null, beforeDate: string | null) => void
  onSchemaUpload: (keySystemId: string, file: File) => Promise<void>
  onSchemaDownload: (keySystemId: string) => Promise<void>
  uploadingSchemaId: string | null
}

export function KeySystemsTable({
  KeySystems,
  propertyMap,
  onEdit,
  onDelete,
  expandedSystemId,
  onToggleExpand,
  keysForExpandedSystem,
  isLoadingKeys,
  selectedType,
  onTypeFilterChange,
  selectedStatus,
  onStatusFilterChange,
  installationDateAfter,
  installationDateBefore,
  onDatesChange,
  onSchemaUpload,
  onSchemaDownload,
  uploadingSchemaId,
}: KeySystemsTableProps) {
  const fileInputRefs = useState<Record<string, HTMLInputElement | null>>(
    () => ({})
  )[0]

  const handleFileSelect = async (
    keySystemId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (file) {
      await onSchemaUpload(keySystemId, file)
      // Clear the input so the same file can be selected again if needed
      event.target.value = ''
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PP', { locale: sv })
    } catch {
      return dateString
    }
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Låssystem</TableHead>
            <TableHead>Tillhörighet</TableHead>
            <TableHead>Tillverkare</TableHead>
            <TableHead>Fastigheter</TableHead>
            <FilterableTableHeader label="Typ">
              <FilterDropdown
                options={getKeySystemTypeFilterOptions()}
                selectedValue={selectedType}
                onSelectionChange={onTypeFilterChange}
              />
            </FilterableTableHeader>
            <FilterableTableHeader label="Status">
              <FilterDropdown
                options={getKeySystemStatusFilterOptions()}
                selectedValue={selectedStatus}
                onSelectionChange={onStatusFilterChange}
              />
            </FilterableTableHeader>
            <TableHead>Schema</TableHead>
            <FilterableTableHeader label="Installationsdatum">
              <DateRangeFilterDropdown
                afterDate={installationDateAfter}
                beforeDate={installationDateBefore}
                onDatesChange={onDatesChange}
              />
            </FilterableTableHeader>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {KeySystems.length === 0 ? (
            <TableEmptyState colSpan={10} message="Inga låssystem hittades" />
          ) : (
            KeySystems.map((KeySystem) => {
              // Parse propertyIds if it's a JSON string
              let propertyIdArray: string[] = []
              if (KeySystem.propertyIds) {
                try {
                  const parsed =
                    typeof KeySystem.propertyIds === 'string'
                      ? JSON.parse(KeySystem.propertyIds)
                      : KeySystem.propertyIds
                  propertyIdArray = Array.isArray(parsed) ? parsed : []
                } catch (e) {
                  console.error('Failed to parse propertyIds:', e)
                }
              }

              const properties = propertyIdArray
                .map((id) => propertyMap.get(id))
                .filter((prop): prop is Property => prop !== undefined)

              const isExpanded = expandedSystemId === KeySystem.id

              return (
                <React.Fragment key={KeySystem.id}>
                  <TableRow>
                    <TableCell>
                      <ExpandButton
                        isExpanded={isExpanded}
                        isLoading={
                          isLoadingKeys && expandedSystemId === KeySystem.id
                        }
                        onClick={() => onToggleExpand(KeySystem.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {KeySystem.systemCode}
                    </TableCell>
                    <TableCell>{KeySystem.name}</TableCell>
                    <TableCell>{KeySystem.manufacturer || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {properties.length > 0 ? (
                          properties.map((property) => (
                            <Badge
                              key={property.id}
                              variant="outline"
                              className="text-xs"
                            >
                              {property.designation}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            -
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <KeySystemTypeBadge type={KeySystem.type} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={KeySystem.isActive ? 'default' : 'secondary'}
                      >
                        {KeySystem.isActive ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {KeySystem.schemaFileId ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => onSchemaDownload(KeySystem.id)}
                            disabled={uploadingSchemaId === KeySystem.id}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              ref={(el) => {
                                fileInputRefs[KeySystem.id] = el
                              }}
                              onChange={(e) =>
                                handleFileSelect(KeySystem.id, e)
                              }
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() =>
                                fileInputRefs[KeySystem.id]?.click()
                              }
                              disabled={uploadingSchemaId === KeySystem.id}
                            >
                              {uploadingSchemaId === KeySystem.id ? (
                                <span className="text-xs">Laddar...</span>
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {KeySystem.installationDate
                        ? formatDate(KeySystem.installationDate.toString())
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <NotePopover text={KeySystem.notes} />
                        <ActionMenu
                          onEdit={() => onEdit(KeySystem)}
                          // onDelete={() => onDelete(KeySystem.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <ExpandedRowFreeContent
                      colSpan={10}
                      isLoading={isLoadingKeys}
                      hasData={keysForExpandedSystem.length > 0}
                      emptyMessage="Inga nycklar hittades för detta låssystem"
                      className="p-0"
                    >
                      <KeysListSectioned
                        keys={keysForExpandedSystem}
                        className=""
                        indent
                      />
                    </ExpandedRowFreeContent>
                  )}
                </React.Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
