import React, { useMemo, useEffect, useState } from 'react'
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
import { KeyBundle, KeyWithLoanAndEvent } from '@/services/types'
import { groupAndSortKeys } from '@/utils/groupKeys'
import { fetchContactByContactCode } from '@/services/api/contactService'
import { KeyBundleKeysList } from '@/components/shared/KeyBundleKeysList'

interface KeyBundlesTableProps {
  keyBundles: KeyBundle[]
  onEdit: (keyBundle: KeyBundle) => void
  onDelete: (id: string) => void
  expandedBundleId: string | null
  onToggleExpand: (bundleId: string) => void
  keysForExpandedBundle: KeyWithLoanAndEvent[]
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

      // Collect all unique contact codes from loaned keys
      grouped.nonDisposed.loaned.forEach((contactGroup) => {
        if (contactGroup.contact) uniqueCompanyCodes.add(contactGroup.contact)
      })
      grouped.disposed.loaned.forEach((contactGroup) => {
        if (contactGroup.contact) uniqueCompanyCodes.add(contactGroup.contact)
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
                              <KeyBundleKeysList
                                group={grouped.nonDisposed}
                                companyNames={companyNames}
                              />
                            </div>
                          )}

                          {/* Disposed keys */}
                          {hasDisposed && (
                            <div>
                              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                                Kasserade nycklar
                              </h3>
                              <KeyBundleKeysList
                                group={grouped.disposed}
                                companyNames={companyNames}
                              />
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
