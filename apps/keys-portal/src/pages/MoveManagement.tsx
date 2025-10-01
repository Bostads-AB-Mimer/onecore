import { useState, useMemo } from 'react'
import { MoveManagementHeader } from '@/components/move-management/MoveManagementHeader'
import { MoveManagementToolbar } from '@/components/move-management/MoveManagementToolbar'
import { MoveOutsTable } from '@/components/move-management/MoveOutsTable'
import { MoveInsTable } from '@/components/move-management/MoveInsTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  mockMoveOutLeases,
  mockMoveInLeases,
  mockFlytthanteringKeyLoans,
} from '@/mockdata/mock-flytthantering'
import { Lease, KeyLoan } from '@/services/types'

export default function MoveManagement() {
  const [moveOutLeases] = useState<Lease[]>(mockMoveOutLeases)
  const [moveInLeases] = useState<Lease[]>(mockMoveInLeases)
  const [keyLoans] = useState<KeyLoan[]>(mockFlytthanteringKeyLoans)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Default to current month
  const now = new Date()
  const [dateFrom, setDateFrom] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  )
  const [dateTo, setDateTo] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0)
  )

  const filterLeases = (leases: Lease[], isMovingOut: boolean) => {
    return leases.filter((lease) => {
      const tenant = lease.tenants?.[0]
      const matchesSearch =
        searchQuery === '' ||
        tenant?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant?.emailAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lease.rentalProperty?.apartmentNumber
          ?.toString()
          .includes(searchQuery) ||
        lease.address?.street.toLowerCase().includes(searchQuery.toLowerCase())

      // Filter by date range
      const dateToCheck = isMovingOut
        ? lease.leaseEndDate
        : lease.leaseStartDate
      const matchesDateRange =
        dateToCheck &&
        new Date(dateToCheck) >= dateFrom &&
        new Date(dateToCheck) <= dateTo

      // Filter by status
      let matchesStatus = true
      if (statusFilter !== 'all') {
        const keyLoan = keyLoans.find((kl) => kl.lease === lease.leaseId)
        const isCompleted = isMovingOut
          ? !!keyLoan?.returnedAt
          : !!keyLoan?.pickedUpAt

        matchesStatus =
          (statusFilter === 'completed' && isCompleted) ||
          (statusFilter === 'pending' && !isCompleted)
      }

      return matchesSearch && matchesDateRange && matchesStatus
    })
  }

  const filteredMoveOuts = useMemo(
    () => filterLeases(moveOutLeases, true),
    [moveOutLeases, searchQuery, dateFrom, dateTo, statusFilter, keyLoans]
  )

  const filteredMoveIns = useMemo(
    () => filterLeases(moveInLeases, false),
    [moveInLeases, searchQuery, dateFrom, dateTo, statusFilter, keyLoans]
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <MoveManagementHeader
          totalMoveOuts={moveOutLeases.length}
          totalMoveIns={moveInLeases.length}
        />

        <MoveManagementToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={(date) => date && setDateFrom(date)}
          onDateToChange={(date) => date && setDateTo(date)}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        <Tabs defaultValue="move-outs" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="move-outs">
              Utflyttningar ({filteredMoveOuts.length})
            </TabsTrigger>
            <TabsTrigger value="move-ins">
              Inflyttningar ({filteredMoveIns.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="move-outs">
            <MoveOutsTable leases={filteredMoveOuts} keyLoans={keyLoans} />
          </TabsContent>

          <TabsContent value="move-ins">
            <MoveInsTable leases={filteredMoveIns} keyLoans={keyLoans} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
