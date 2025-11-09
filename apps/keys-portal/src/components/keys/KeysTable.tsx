import React, { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Key, KeyLoan, KeyBundle, KeyTypeLabels, getKeyTypeFilterOptions, LoanTypeLabels } from '@/services/types'
import { FilterDropdown } from '@/components/ui/filter-dropdown'
import { DateRangeFilterDropdown } from '@/components/ui/date-range-filter-dropdown'
import { useNavigate } from 'react-router-dom'
import { keyLoanService } from '@/services/api/keyLoanService'
import { getKeyBundlesByKeyId } from '@/services/api/keyBundleService'
import { fetchContactByContactCode } from '@/services/api/contactService'

interface KeysTableProps {
  keys: Key[]
  keySystemMap: Record<string, string>
  onEdit: (key: Key) => void
  onDelete: (keyId: string) => void
  selectedType: string | null
  onTypeFilterChange: (value: string | null) => void
  selectedDisposed: string | null
  onDisposedFilterChange: (value: string | null) => void
  createdAtAfter: string | null
  createdAtBefore: string | null
  onDatesChange: (afterDate: string | null, beforeDate: string | null) => void
}

export function KeysTable({
  keys,
  keySystemMap,
  onEdit,
  onDelete,
  selectedType,
  onTypeFilterChange,
  selectedDisposed,
  onDisposedFilterChange,
  createdAtAfter,
  createdAtBefore,
  onDatesChange,
}: KeysTableProps) {
  const navigate = useNavigate()
  const [expandedKeyId, setExpandedKeyId] = useState<string | null>(null)
  const [keyDetails, setKeyDetails] = useState<{
    loans: KeyLoan[]
    bundles: KeyBundle[]
  } | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [contactNames, setContactNames] = useState<Record<string, string>>({})

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sv-SE')
  }

  const handleObjectClick = (rentalObjectCode: string) => {
    navigate(`/KeyLoan?object=${rentalObjectCode}`)
  }

  const handleToggleExpand = async (keyId: string) => {
    if (expandedKeyId === keyId) {
      // Collapse if already expanded
      setExpandedKeyId(null)
      setKeyDetails(null)
    } else {
      // Expand and load details
      setExpandedKeyId(keyId)
      setIsLoadingDetails(true)
      try {
        // Fetch key loans and bundles in parallel
        const [loans, bundles] = await Promise.all([
          keyLoanService.getByKeyId(keyId),
          getKeyBundlesByKeyId(keyId),
        ])

        // Sort loans by createdAt descending (newest first)
        const sortedLoans = loans.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

        // Sort bundles by name alphabetically
        const sortedBundles = bundles.sort((a, b) =>
          a.name.localeCompare(b.name)
        )

        setKeyDetails({ loans: sortedLoans, bundles: sortedBundles })

        // Fetch contact names for the loans
        const uniqueContactCodes = new Set<string>()
        loans.forEach((loan) => {
          if (loan.contact) uniqueContactCodes.add(loan.contact)
          if (loan.contact2) uniqueContactCodes.add(loan.contact2)
        })

        const names: Record<string, string> = {}
        await Promise.all(
          Array.from(uniqueContactCodes).map(async (contactCode) => {
            try {
              const contact = await fetchContactByContactCode(contactCode)
              if (contact) {
                const parts = [contact.fullName, contactCode]
                if (contact.nationalRegistrationNumber) {
                  parts.push(contact.nationalRegistrationNumber)
                }
                names[contactCode] = parts.join(' · ')
              }
            } catch (error) {
              console.error(`Failed to fetch contact ${contactCode}:`, error)
              names[contactCode] = contactCode
            }
          })
        )
        setContactNames(names)
      } catch (error) {
        console.error('Failed to load key details:', error)
        setKeyDetails(null)
      } finally {
        setIsLoadingDetails(false)
      }
    }
  }

  const getKeyCount = (keysString: string) => {
    try {
      const keys = JSON.parse(keysString)
      return Array.isArray(keys) ? keys.length : 0
    } catch {
      return 0
    }
  }

  const getContactDisplay = (loan: KeyLoan) => {
    const contacts: string[] = []
    if (loan.contact && contactNames[loan.contact]) {
      contacts.push(contactNames[loan.contact])
    } else if (loan.contact) {
      contacts.push(loan.contact)
    }

    if (loan.contact2 && contactNames[loan.contact2]) {
      contacts.push(contactNames[loan.contact2])
    } else if (loan.contact2) {
      contacts.push(loan.contact2)
    }

    return contacts.length > 0 ? contacts.join(', ') : '-'
  }

  const getLoanStatus = (loan: KeyLoan) => {
    if (loan.returnedAt) {
      return <Badge variant="secondary">Återlämnad</Badge>
    } else if (loan.pickedUpAt) {
      return <Badge variant="default" className="bg-green-600">Aktiv</Badge>
    } else {
      return <Badge variant="outline" className="text-muted-foreground">Ej upphämtad</Badge>
    }
  }

  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'LGH':
        return 'default'
      case 'PB':
        return 'secondary'
      case 'FS':
        return 'outline'
      case 'HN':
        return 'destructive'
      case 'MV':
        return 'default'
      case 'GAR':
        return 'secondary'
      case 'LOK':
        return 'outline'
      case 'HL':
        return 'secondary'
      case 'FÖR':
        return 'default'
      case 'SOP':
        return 'outline'
      case 'ÖVR':
        return 'secondary'
      default:
        return 'default'
    }
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="w-[50px]"></TableHead>
            <TableHead className="font-medium">Nyckelnamn</TableHead>
            <TableHead className="font-medium">Objekt</TableHead>
            <TableHead className="font-medium">
              <div className="flex items-center gap-1">
                Typ
                <FilterDropdown
                  options={getKeyTypeFilterOptions()}
                  selectedValue={selectedType}
                  onSelectionChange={onTypeFilterChange}
                />
              </div>
            </TableHead>
            <TableHead className="font-medium">Låssystem</TableHead>
            <TableHead className="font-medium">Löpnummer</TableHead>
            <TableHead className="font-medium">Flexnr</TableHead>
            <TableHead className="font-medium">
              <div className="flex items-center gap-1">
                Kasserad
                <FilterDropdown
                  options={[
                    { label: 'Ja', value: 'true' },
                    { label: 'Nej', value: 'false' },
                  ]}
                  selectedValue={selectedDisposed}
                  onSelectionChange={onDisposedFilterChange}
                />
              </div>
            </TableHead>
            <TableHead className="font-medium">
              <div className="flex items-center gap-1">
                Skapad
                <DateRangeFilterDropdown
                  afterDate={createdAtAfter}
                  beforeDate={createdAtBefore}
                  onDatesChange={onDatesChange}
                />
              </div>
            </TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={10}
                className="text-center py-8 text-muted-foreground"
              >
                Inga nycklar hittades
              </TableCell>
            </TableRow>
          ) : (
            keys.map((key) => {
              const isExpanded = expandedKeyId === key.id
              return (
                <React.Fragment key={key.id}>
                  {/* Main key row */}
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleExpand(key.id)}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{key.keyName}</TableCell>
                    <TableCell>
                      {key.rentalObjectCode ? (
                        <button
                          onClick={() => handleObjectClick(key.rentalObjectCode!)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {key.rentalObjectCode}
                        </button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getTypeVariant(key.keyType)}
                        className="text-xs"
                      >
                        {KeyTypeLabels[key.keyType]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {key.keySystemId && keySystemMap[key.keySystemId]
                        ? keySystemMap[key.keySystemId]
                        : key.keySystemId || '-'}
                    </TableCell>
                    <TableCell>{key.keySequenceNumber || '-'}</TableCell>
                    <TableCell>{key.flexNumber || '-'}</TableCell>
                    <TableCell>
                      {key.disposed ? (
                        <Badge variant="destructive" className="text-xs">
                          Ja
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Nej
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(key.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(key)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Redigera
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(key.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Ta bort
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>

                  {/* Expanded section */}
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={10} className="p-6 bg-muted/30">
                        {isLoadingDetails ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        ) : !keyDetails ? (
                          <div className="text-center text-muted-foreground py-8">
                            Kunde inte ladda detaljer för denna nyckel
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Key Loans Section */}
                            {keyDetails.loans.length > 0 && (
                              <div>
                                <h3 className="text-lg font-semibold mb-3">Nyckellån</h3>
                                <div className="rounded-md border bg-card">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Kontakt</TableHead>
                                        <TableHead>Lånetyp</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Skapad</TableHead>
                                        <TableHead>Upphämtat</TableHead>
                                        <TableHead>Återlämnat</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {keyDetails.loans.map((loan) => (
                                        <TableRow key={loan.id}>
                                          <TableCell className="font-medium">
                                            {getContactDisplay(loan)}
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="outline">
                                              {LoanTypeLabels[loan.loanType]}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>{getLoanStatus(loan)}</TableCell>
                                          <TableCell>{formatDate(loan.createdAt)}</TableCell>
                                          <TableCell>{formatDate(loan.pickedUpAt)}</TableCell>
                                          <TableCell>{formatDate(loan.returnedAt)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            {/* Key Bundles Section */}
                            {keyDetails.bundles.length > 0 && (
                              <div>
                                <h3 className="text-lg font-semibold mb-3">Nyckelsamlingar</h3>
                                <div className="rounded-md border bg-card">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Namn</TableHead>
                                        <TableHead>Beskrivning</TableHead>
                                        <TableHead>Antal nycklar</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {keyDetails.bundles.map((bundle) => (
                                        <TableRow key={bundle.id}>
                                          <TableCell className="font-medium">
                                            {bundle.name}
                                          </TableCell>
                                          <TableCell>
                                            {bundle.description || '-'}
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="secondary">
                                              {getKeyCount(bundle.keys)}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            {/* No results message */}
                            {keyDetails.loans.length === 0 && keyDetails.bundles.length === 0 && (
                              <div className="text-center text-muted-foreground py-8">
                                Denna nyckel ingår inte i några lån eller samlingar
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
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
