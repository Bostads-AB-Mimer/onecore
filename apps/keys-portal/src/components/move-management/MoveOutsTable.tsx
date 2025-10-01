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
import { CheckCircle2, XCircle, Eye } from 'lucide-react'
import { Lease, KeyLoan } from '@/services/types'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'

interface MoveOutsTableProps {
  leases: Lease[]
  keyLoans: KeyLoan[]
  onMarkReturned?: (leaseId: string) => void
  onViewDetails?: (leaseId: string) => void
}

export function MoveOutsTable({
  leases,
  keyLoans,
  onMarkReturned,
  onViewDetails,
}: MoveOutsTableProps) {
  const getKeyStatus = (leaseId: string) => {
    const loan = keyLoans.find((kl) => kl.lease === leaseId)
    return {
      returned: !!loan?.returnedAt,
      returnedAt: loan?.returnedAt,
    }
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'PP', { locale: sv })
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="font-medium">Hyresgäst</TableHead>
            <TableHead className="font-medium">Lägenhet</TableHead>
            <TableHead className="font-medium">Adress</TableHead>
            <TableHead className="font-medium">Utflyttningsdatum</TableHead>
            <TableHead className="font-medium">Kontakt</TableHead>
            <TableHead className="font-medium">Nycklar</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leases.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center py-8 text-muted-foreground"
              >
                Inga utflyttningar hittades
              </TableCell>
            </TableRow>
          ) : (
            leases.map((lease) => {
              const keyStatus = getKeyStatus(lease.leaseId)
              const tenant = lease.tenants?.[0]
              const apartmentNumber =
                lease.rentalProperty?.apartmentNumber?.toString() || '-'
              const address = lease.address
                ? `${lease.address.street} ${lease.address.number}, ${lease.address.city}`
                : '-'

              return (
                <TableRow key={lease.leaseId} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {tenant?.fullName || '-'}
                  </TableCell>
                  <TableCell>{apartmentNumber}</TableCell>
                  <TableCell>{address}</TableCell>
                  <TableCell>
                    {lease.leaseEndDate
                      ? formatDate(lease.leaseEndDate)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{tenant?.emailAddress || '-'}</div>
                      <div className="text-muted-foreground">
                        {tenant?.phoneNumbers?.[0]?.phoneNumber || '-'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {keyStatus.returned ? (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="default"
                          className="bg-green-100 text-green-800 hover:bg-green-100"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Återlämnade
                        </Badge>
                        {keyStatus.returnedAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(keyStatus.returnedAt)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge
                        variant="destructive"
                        className="bg-red-100 text-red-800"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Ej återlämnade
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {onViewDetails && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onViewDetails(lease.leaseId)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
