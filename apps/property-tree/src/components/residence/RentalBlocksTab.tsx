import { components } from '@/services/api/generated/api-types'
import { ResponsiveTable } from '../ui/ResponsiveTable'
import { TabLayout } from '../ui/TabLayout'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/v2/Card'
import { useState } from 'react'
import { Button } from '../ui/v2/Button'
import { useQuery } from '@tanstack/react-query'
import { useRentalBlocks } from '../hooks/useRentalBlocks'
import { Badge } from '../ui/v3/Badge'

const INITIAL_DISPLAY_COUNT = 5

function RentalBlocksTab({ rentalId }: { rentalId: string }) {
  const [showAll, setShowAll] = useState(false)

  const { data: rentalBlocks, isLoading } = useRentalBlocks(rentalId)

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

  const formatISODate = (isoDateString: string | null | undefined) => {
    if (!isoDateString) return '-'

    const date = new Date(isoDateString)
    return date.toLocaleDateString('sv-SE')
  }

  const isExpired = (toDate: string | null | undefined) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isExpired = toDate && new Date(toDate) < today
    return isExpired
  }

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
                return isExpired(rb.toDate) ? (
                  <Badge variant="destructive">Inaktiv</Badge>
                ) : (
                  <Badge variant="success">Aktiv</Badge>
                )
              },
            },
          ]}
          keyExtractor={(rb) => rb.id}
          mobileCardRenderer={(rb: components['schemas']['RentalBlock']) => (
            <div className="space-y-2 w-full">
              <div className="flex flex-auto justify-between items-start">
                <div>
                  <div className="text-sm">
                    {formatISODate(rb.fromDate)} - {formatISODate(rb.toDate)}
                  </div>
                  <div className="font-medium">{rb.blockReason}</div>
                </div>
                {isExpired(rb.toDate) ? (
                  <Badge className="mt-1" variant="destructive">
                    Inaktiv
                  </Badge>
                ) : (
                  <Badge className="mt-1" variant="success">
                    Aktiv
                  </Badge>
                )}
              </div>
            </div>
          )}
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

export default RentalBlocksTab
