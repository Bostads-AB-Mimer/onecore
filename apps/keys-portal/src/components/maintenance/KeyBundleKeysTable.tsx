import { useMemo } from 'react'
import type { KeyWithMaintenanceLoanStatus } from '@/services/types'
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

interface KeyBundleKeysTableProps {
  keys: KeyWithMaintenanceLoanStatus[]
  bundleName: string
}

export function KeyBundleKeysTable({
  keys,
  bundleName,
}: KeyBundleKeysTableProps) {
  const grouped = useMemo(() => groupAndSortKeys(keys), [keys])

  if (keys.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Inga nycklar i denna nyckelsamling
        </CardContent>
      </Card>
    )
  }

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
          {/* Non-Disposed Keys */}
          {(grouped.nonDisposed.loaned.length > 0 ||
            grouped.nonDisposed.unloaned.length > 0) && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-green-600">
                Aktiva nycklar
              </h3>
              {renderDisposedGroup(grouped.nonDisposed)}
            </div>
          )}

          {/* Disposed Keys */}
          {(grouped.disposed.loaned.length > 0 ||
            grouped.disposed.unloaned.length > 0) && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                Avvecklade nycklar
              </h3>
              {renderDisposedGroup(grouped.disposed)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function renderDisposedGroup(group: GroupedKeys['nonDisposed']) {
  return (
    <div className="space-y-4">
      {/* Loaned Keys */}
      {group.loaned.length > 0 && (
        <div className="space-y-3">
          {group.loaned.map((companyGroup) => (
            <div key={companyGroup.company} className="space-y-2">
              <h4 className="text-md font-medium text-blue-600">
                {companyGroup.company}
              </h4>
              {companyGroup.loans.map((loan) => (
                <div
                  key={loan.loanId}
                  className="border rounded-lg p-3 bg-muted/30"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline">Lånad</Badge>
                    {loan.loanContactPerson && (
                      <span className="text-sm text-muted-foreground">
                        Kontakt: {loan.loanContactPerson}
                      </span>
                    )}
                    {loan.loanPickedUpAt && (
                      <span className="text-sm text-muted-foreground">
                        Upphämtad: {formatAbsoluteTime(loan.loanPickedUpAt)}
                      </span>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nyckelnamn</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Flex-nummer</TableHead>
                        <TableHead>Hyresobjekt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loan.keys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="font-medium">
                            {key.keyName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {
                                KeyTypeLabels[
                                  key.keyType as keyof typeof KeyTypeLabels
                                ]
                              }
                            </Badge>
                          </TableCell>
                          <TableCell>{key.flexNumber ?? '-'}</TableCell>
                          <TableCell>{key.rentalObjectCode ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Unloaned Keys */}
      {group.unloaned.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-md font-medium text-muted-foreground">
            Ej utlånade
          </h4>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nyckelnamn</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Flex-nummer</TableHead>
                  <TableHead>Hyresobjekt</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.unloaned.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.keyName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {
                          KeyTypeLabels[
                            key.keyType as keyof typeof KeyTypeLabels
                          ]
                        }
                      </Badge>
                    </TableCell>
                    <TableCell>{key.flexNumber ?? '-'}</TableCell>
                    <TableCell>{key.rentalObjectCode ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50">
                        Tillgänglig
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
