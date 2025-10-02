import { useState, useMemo, useEffect } from 'react'
import { MoveManagementHeader } from '@/components/move-management/MoveManagementHeader'
import { MoveManagementToolbar } from '@/components/move-management/MoveManagementToolbar'
import { MoveOutsTable } from '@/components/move-management/MoveOutsTable'
import { MoveInsTable } from '@/components/move-management/MoveInsTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Lease, KeyLoan } from '@/services/types'
import {
  fetchLeasesByMoveInDateRange,
  fetchLeasesByMoveOutDateRange,
} from '@/services/api/leaseService'
import { keyService } from '@/services/api/keyService'

export default function MoveManagement() {
  const [moveOutLeases, setMoveOutLeases] = useState<Lease[]>([])
  const [moveInLeases, setMoveInLeases] = useState<Lease[]>([])
  const [keyLoans, setKeyLoans] = useState<KeyLoan[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Default: current month for move-outs, next month for move-ins
  const now = new Date()
  const [moveOutMonth, setMoveOutMonth] = useState(now.getMonth())
  const [moveOutYear, setMoveOutYear] = useState(now.getFullYear())
  const [moveInMonth, setMoveInMonth] = useState((now.getMonth() + 1) % 12)
  const [moveInYear, setMoveInYear] = useState(
    now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  )

  // Fetch data when month/year changes
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // Calculate date ranges for the selected months
        const moveOutFrom = new Date(moveOutYear, moveOutMonth, 1)
        const moveOutTo = new Date(moveOutYear, moveOutMonth + 1, 0)
        const moveInFrom = new Date(moveInYear, moveInMonth, 1)
        const moveInTo = new Date(moveInYear, moveInMonth + 1, 0)

        // Format dates as ISO strings (YYYY-MM-DD)
        const moveOutFromStr = moveOutFrom.toISOString().split('T')[0]
        const moveOutToStr = moveOutTo.toISOString().split('T')[0]
        const moveInFromStr = moveInFrom.toISOString().split('T')[0]
        const moveInToStr = moveInTo.toISOString().split('T')[0]

        // Fetch move-ins and move-outs in parallel
        const [moveIns, moveOuts, allKeyLoans] = await Promise.all([
          fetchLeasesByMoveInDateRange(moveInFromStr, moveInToStr),
          fetchLeasesByMoveOutDateRange(moveOutFromStr, moveOutToStr),
          keyService.getAllKeyLoans(),
        ])

        setMoveInLeases(moveIns)
        setMoveOutLeases(moveOuts)
        setKeyLoans(allKeyLoans)
      } catch (error) {
        console.error('Error fetching move management data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [moveOutMonth, moveOutYear, moveInMonth, moveInYear])

  const filterLeases = (leases: Lease[]) => {
    return leases.filter((lease) => {
      const tenants = lease.tenants || []
      const matchesSearch =
        searchQuery === '' ||
        tenants.some(t => t.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        tenants.some(t => t.emailAddress?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        tenants.some(t => t.contactCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        lease.rentalPropertyId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lease.address?.street.toLowerCase().includes(searchQuery.toLowerCase())

      // Filter by status
      let matchesStatus = true
      if (statusFilter !== 'all') {
        const keyLoan = keyLoans.find((kl) => kl.lease === lease.leaseId)

        if (statusFilter === 'completed') {
          const isCompleted = !!keyLoan?.returnedAt || !!keyLoan?.pickedUpAt
          matchesStatus = isCompleted
        } else if (statusFilter === 'pending') {
          const isCompleted = !!keyLoan?.returnedAt || !!keyLoan?.pickedUpAt
          matchesStatus = !isCompleted
        }
      }

      return matchesSearch && matchesStatus
    })
  }

  const filteredMoveOuts = useMemo(
    () => filterLeases(moveOutLeases),
    [moveOutLeases, searchQuery, statusFilter, keyLoans]
  )

  const filteredMoveIns = useMemo(
    () => filterLeases(moveInLeases),
    [moveInLeases, searchQuery, statusFilter, keyLoans]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laddar flytthantering...</p>
      </div>
    )
  }

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
          moveOutMonth={moveOutMonth}
          moveOutYear={moveOutYear}
          moveInMonth={moveInMonth}
          moveInYear={moveInYear}
          onMoveOutMonthChange={setMoveOutMonth}
          onMoveOutYearChange={setMoveOutYear}
          onMoveInMonthChange={setMoveInMonth}
          onMoveInYearChange={setMoveInYear}
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
