import { components } from '@/services/api/generated/api-types'
import { ResponsiveTable } from '../../../components/ui/ResponsiveTable'
import { TabLayout } from '../../../components/ui/TabLayout'
import { useState } from 'react'
import { Button } from '../../../components/ui/v2/Button'
import { useRentalBlocksByRentalId } from '@/features/rental-blocks/hooks/useRentalBlocksByRentalId'
import { Badge } from '../../../components/ui/v3/Badge'
import { formatISODate } from '@/utils/formatters'

const INITIAL_DISPLAY_COUNT = 5

type BlockStatus = 'active' | 'expired' | 'upcoming'

const getBlockStatus = (
  fromDate: string,
  toDate: string | null | undefined
): BlockStatus => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const from = new Date(fromDate)
  from.setHours(0, 0, 0, 0)

  // Upcoming: hasn't started yet
  if (from > today) return 'upcoming'

  // Expired: already ended
  if (toDate) {
    const to = new Date(toDate)
    to.setHours(0, 0, 0, 0)
    if (to < today) return 'expired'
  }

  // Active: started and not ended
  return 'active'
}

const StatusBadge = ({ status }: { status: BlockStatus }) => {
  switch (status) {
    case 'active':
      return <Badge variant="success">Aktiv</Badge>
    case 'expired':
      return <Badge variant="destructive">Utgången</Badge>
    case 'upcoming':
      return <Badge variant="outline">Kommande</Badge>
  }
}

export const RentalBlocksTabContent = ({ rentalId }: { rentalId: string }) => {
  const [showAll, setShowAll] = useState(false)

  const { data: rentalBlocks, isLoading } = useRentalBlocksByRentalId(rentalId)

  if (isLoading) {
    return (
      <TabLayout title="Spärrar" showCard={true}>
        <div className="py-4">
          <div>Laddar...</div>
        </div>
      </TabLayout>
    )
  }

  if (!rentalBlocks || rentalBlocks.length === 0) {
    return (
      <TabLayout title="Spärrar" showCard={true}>
        <div className="py-4">
          <div>Inga spärrar hittades.</div>
        </div>
      </TabLayout>
    )
  }

  const displayedRentalBlocks = showAll
    ? rentalBlocks
    : rentalBlocks.slice(0, INITIAL_DISPLAY_COUNT)
  const hasMoreRentalBlocks = rentalBlocks.length > INITIAL_DISPLAY_COUNT

  return (
    <TabLayout title="Spärrar" showCard={true}>
      <p className="text-sm text-muted-foreground">
        Spärrar administreras för närvarande fortfarande i xpand.
      </p>
      <div className="space-y-4">
        <ResponsiveTable
          data={displayedRentalBlocks}
          columns={[
            {
              key: 'reason',
              label: 'Spärranledning',
              render: (rb: components['schemas']['RentalBlock']) =>
                rb.blockReason,
            },
            {
              key: 'fromDate',
              label: 'Från och med',
              render: (rb: components['schemas']['RentalBlock']) =>
                formatISODate(rb.fromDate),
            },
            {
              key: 'toDate',
              label: 'Till och med',
              render: (rb: components['schemas']['RentalBlock']) =>
                formatISODate(rb.toDate),
            },
            {
              key: 'status',
              label: 'Status',
              render: (rb: components['schemas']['RentalBlock']) => {
                const status = getBlockStatus(rb.fromDate, rb.toDate)
                return <StatusBadge status={status} />
              },
            },
          ]}
          keyExtractor={(rb) => rb.id}
          mobileCardRenderer={(rb: components['schemas']['RentalBlock']) => {
            const status = getBlockStatus(rb.fromDate, rb.toDate)
            return (
              <div className="space-y-2 w-full">
                <div className="flex flex-auto justify-between items-start">
                  <div>
                    <div className="text-sm">
                      {formatISODate(rb.fromDate)} - {formatISODate(rb.toDate)}
                    </div>
                    <div className="font-medium">{rb.blockReason}</div>
                  </div>
                  <div className="mt-1">
                    <StatusBadge status={status} />
                  </div>
                </div>
              </div>
            )
          }}
        />

        {hasMoreRentalBlocks && !showAll && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setShowAll(true)}>
              Se fler ({rentalBlocks.length - INITIAL_DISPLAY_COUNT} till)
            </Button>
          </div>
        )}

        {showAll && hasMoreRentalBlocks && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setShowAll(false)}>
              Visa färre
            </Button>
          </div>
        )}
      </div>
    </TabLayout>
  )
}
