import { useMemo, useEffect, useState } from 'react'
import type { KeyWithMaintenanceLoanStatus, Contact } from '@/services/types'
import { groupAndSortKeys, type GroupedKeys } from '@/utils/groupKeys'
import { KeyTypeLabels } from '@/services/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatAbsoluteTime } from '@/lib/dateUtils'
import { fetchContactByContactCode } from '@/services/api/contactService'

interface KeyBundleKeysTableProps {
  keys: KeyWithMaintenanceLoanStatus[]
  bundleName: string
}

export function KeyBundleKeysTable({
  keys,
  bundleName,
}: KeyBundleKeysTableProps) {
  const grouped = useMemo(() => groupAndSortKeys(keys), [keys])
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})

  // Fetch company names for all unique company codes
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

    fetchCompanyNames()
  }, [grouped])

  if (keys.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Inga nycklar i denna nyckelsamling
        </CardContent>
      </Card>
    )
  }

  const hasNonDisposed =
    grouped.nonDisposed.loaned.length > 0 ||
    grouped.nonDisposed.unloaned.length > 0
  const hasDisposed =
    grouped.disposed.loaned.length > 0 || grouped.disposed.unloaned.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nycklar i {bundleName}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Totalt {keys.length} nycklar
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Aktiva nycklar table */}
          {hasNonDisposed && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-green-600">
                Aktiva nycklar
              </h3>
              {renderUnifiedTable(grouped.nonDisposed, companyNames)}
            </div>
          )}

          {/* Kasserade nycklar table */}
          {hasDisposed ? (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                Kasserade nycklar
              </h3>
              {renderUnifiedTable(grouped.disposed, companyNames)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Inga kasserade nycklar
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Renders a unified table with grouping rows for companies, loans, and unloaned keys
 */
function renderUnifiedTable(
  group: GroupedKeys['nonDisposed'],
  companyNames: Record<string, string>
) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Nyckelnamn</TableHead>
            <TableHead className="w-[25%]">Typ</TableHead>
            <TableHead className="w-[20%]">Flex-nummer</TableHead>
            <TableHead className="w-[20%]">Hyresobjekt</TableHead>
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
                <TableCell colSpan={4} className="font-semibold py-4">
                  {companyNames[companyGroup.company] || companyGroup.company}
                </TableCell>
              </TableRow>

              {/* Loans within this company */}
              {companyGroup.loans.map((loan) => (
                <>
                  {/* Loan header row */}
                  <TableRow
                    key={`loan-${loan.loanId}`}
                    className="bg-muted/50 hover:bg-muted/50"
                  >
                    <TableCell colSpan={4} className="font-medium text-sm pl-8">
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
                  {loan.keys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium w-[35%] pl-8">
                        {key.keyName}
                      </TableCell>
                      <TableCell className="w-[25%]">
                        <Badge variant="secondary">
                          {
                            KeyTypeLabels[
                              key.keyType as keyof typeof KeyTypeLabels
                            ]
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[20%]">
                        {key.flexNumber ?? '-'}
                      </TableCell>
                      <TableCell className="w-[20%]">
                        {key.rentalObjectCode ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
            </>
          ))}

          {/* Unloaned keys section */}
          {group.unloaned.length > 0 && (
            <>
              {/* Unloaned header row */}
              <TableRow className="bg-muted hover:bg-muted">
                <TableCell colSpan={4} className="font-semibold py-4">
                  Ej utlånade
                </TableCell>
              </TableRow>

              {/* Key data rows for unloaned keys */}
              {group.unloaned.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium w-[35%] pl-8">
                    {key.keyName}
                  </TableCell>
                  <TableCell className="w-[25%]">
                    <Badge variant="secondary">
                      {KeyTypeLabels[key.keyType as keyof typeof KeyTypeLabels]}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[20%]">
                    {key.flexNumber ?? '-'}
                  </TableCell>
                  <TableCell className="w-[20%]">
                    {key.rentalObjectCode ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
