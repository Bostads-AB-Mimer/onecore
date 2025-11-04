import { useMemo, useEffect, useState } from 'react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import {
  KeyBundle,
  KeyWithMaintenanceLoanStatus,
  KeyTypeLabels,
} from '@/services/types'
import { groupAndSortKeys } from '@/utils/groupKeys'
import { formatAbsoluteTime } from '@/lib/dateUtils'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { getKeyEventDisplayLabel } from '@/services/types'

interface KeyBundlesTableProps {
  keyBundles: KeyBundle[]
  onEdit: (keyBundle: KeyBundle) => void
  onDelete: (id: string) => void
  expandedBundleId: string | null
  onToggleExpand: (bundleId: string) => void
  keysForExpandedBundle: KeyWithMaintenanceLoanStatus[]
  isLoadingKeys: boolean
  isLoading: boolean
}

export function KeyBundlesTable({
  keyBundles,
  onEdit,
  onDelete,
  expandedBundleId,
  onToggleExpand,
  keysForExpandedBundle,
  isLoadingKeys,
  isLoading,
}: KeyBundlesTableProps) {
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})

  // Group keys when expanded
  const grouped = useMemo(
    () => groupAndSortKeys(keysForExpandedBundle),
    [keysForExpandedBundle]
  )

  // Fetch company names for loaned keys
  useEffect(() => {
    const fetchCompanyNames = async () => {
      const uniqueCompanyCodes = new Set<string>()

      // Collect all unique company codes from loaned keys
      grouped.nonDisposed.loaned.forEach((companyGroup) => {
        if (companyGroup.company) uniqueCompanyCodes.add(companyGroup.company)
      })
      grouped.disposed.loaned.forEach((companyGroup) => {
        if (companyGroup.company) uniqueCompanyCodes.add(companyGroup.company)
      })

      // Fetch contact info for each company code
      const names: Record<string, string> = {}
      await Promise.all(
        Array.from(uniqueCompanyCodes).map(async (companyCode) => {
          const contact = await fetchContactByContactCode(companyCode)
          if (contact) {
            // Format: Name · Code · NationalRegistrationNumber
            const parts = [contact.fullName, companyCode]
            if (contact.nationalRegistrationNumber) {
              parts.push(contact.nationalRegistrationNumber)
            }
            names[companyCode] = parts.join(' · ')
          }
        })
      )

      setCompanyNames(names)
    }

    if (expandedBundleId && keysForExpandedBundle.length > 0) {
      fetchCompanyNames()
    }
  }, [grouped, expandedBundleId, keysForExpandedBundle])

  const hasNonDisposed =
    grouped.nonDisposed.loaned.length > 0 ||
    grouped.nonDisposed.unloaned.length > 0
  const hasDisposed =
    grouped.disposed.loaned.length > 0 || grouped.disposed.unloaned.length > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (keyBundles.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Inga nyckelsamlingar hittades
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Namn</TableHead>
            <TableHead>Beskrivning</TableHead>
            <TableHead>Antal nycklar</TableHead>
            <TableHead className="text-right">Åtgärder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keyBundles.map((bundle) => {
            const isExpanded = expandedBundleId === bundle.id
            let keyCount = 0
            try {
              const keys = JSON.parse(bundle.keys)
              keyCount = Array.isArray(keys) ? keys.length : 0
            } catch (e) {
              keyCount = 0
            }

            return (
              <>
                {/* Main bundle row */}
                <TableRow key={bundle.id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleExpand(bundle.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{bundle.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {bundle.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{keyCount}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(bundle)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Redigera
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(bundle.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Ta bort
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>

                {/* Expanded keys section */}
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={5} className="p-6 bg-muted/30">
                      {isLoadingKeys ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : keysForExpandedBundle.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          Inga nycklar i denna samling
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Active keys */}
                          {hasNonDisposed && (
                            <div>
                              <h3 className="text-lg font-semibold mb-3 text-green-600">
                                Aktiva nycklar
                              </h3>
                              {renderGroupedKeysTable(
                                grouped.nonDisposed,
                                companyNames
                              )}
                            </div>
                          )}

                          {/* Disposed keys */}
                          {hasDisposed && (
                            <div>
                              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                                Kasserade nycklar
                              </h3>
                              {renderGroupedKeysTable(
                                grouped.disposed,
                                companyNames
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Renders a key row
 */
function renderKeyRow(
  key: KeyWithMaintenanceLoanStatus,
  indent: boolean = false
) {
  return (
    <TableRow key={key.id}>
      <TableCell className={`font-medium w-[22%] ${indent ? 'pl-8' : ''}`}>
        {key.keyName}
      </TableCell>
      <TableCell className="w-[8%]">{key.keySequenceNumber ?? '-'}</TableCell>
      <TableCell className="w-[8%]">{key.flexNumber ?? '-'}</TableCell>
      <TableCell className="w-[22%]">
        {key.latestEvent && key.latestEvent.status !== 'COMPLETED' ? (
          <Badge variant="outline">
            {getKeyEventDisplayLabel(key.latestEvent)}
          </Badge>
        ) : (
          '-'
        )}
      </TableCell>
      <TableCell className="w-[15%]">
        <Badge variant="secondary">
          {KeyTypeLabels[key.keyType as keyof typeof KeyTypeLabels]}
        </Badge>
      </TableCell>
      <TableCell className="w-[25%]">{key.rentalObjectCode ?? '-'}</TableCell>
    </TableRow>
  )
}

/**
 * Renders grouped keys table with company and loan headers
 */
function renderGroupedKeysTable(
  group: { loaned: any[]; unloaned: KeyWithMaintenanceLoanStatus[] },
  companyNames: Record<string, string>
) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[22%]">Nyckelnamn</TableHead>
            <TableHead className="w-[8%]">Löpnr</TableHead>
            <TableHead className="w-[8%]">Flex</TableHead>
            <TableHead className="w-[22%]">Status</TableHead>
            <TableHead className="w-[15%]">Typ</TableHead>
            <TableHead className="w-[25%]">Hyresobjekt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Loaned keys grouped by company then loan */}
          {group.loaned.map((companyGroup) => (
            <>
              {/* Company header row */}
              <TableRow
                key={`company-${companyGroup.company}`}
                className="bg-muted hover:bg-muted"
              >
                <TableCell colSpan={6} className="font-semibold py-4">
                  {companyNames[companyGroup.company] || companyGroup.company}
                </TableCell>
              </TableRow>

              {/* Loans within this company */}
              {companyGroup.loans.map((loan: any) => (
                <>
                  {/* Loan header row */}
                  <TableRow
                    key={`loan-${loan.loanId}`}
                    className="bg-muted/50 hover:bg-muted/50"
                  >
                    <TableCell colSpan={6} className="font-medium text-sm pl-8">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">Lånad</Badge>
                        {loan.loanContactPerson && (
                          <span className="text-muted-foreground">
                            Kontakt: {loan.loanContactPerson}
                          </span>
                        )}
                        {loan.loanPickedUpAt && (
                          <span className="text-muted-foreground">
                            Upphämtad: {formatAbsoluteTime(loan.loanPickedUpAt)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Key data rows for this loan */}
                  {loan.keys.map((key: KeyWithMaintenanceLoanStatus) =>
                    renderKeyRow(key, true)
                  )}
                </>
              ))}
            </>
          ))}

          {/* Unloaned keys section */}
          {group.unloaned.length > 0 && (
            <>
              {/* Unloaned header row */}
              <TableRow className="bg-muted hover:bg-muted">
                <TableCell colSpan={6} className="font-semibold py-4">
                  Ej utlånade
                </TableCell>
              </TableRow>

              {/* Key data rows for unloaned keys */}
              {group.unloaned.map((key) => renderKeyRow(key, true))}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
