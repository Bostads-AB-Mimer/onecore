import type { RentalBlockWithRentalObject } from '@/services/types'
import { formatISODate } from '@/shared/lib/formatters'

export function RentalBlockMobileCard({
  block,
}: {
  block: RentalBlockWithRentalObject
}) {
  return (
    <div className="space-y-2 w-full">
      <div className="flex justify-between items-start">
        <div>
          <span className="font-medium">
            {block.rentalObject?.rentalId || block.rentalObject?.code || '-'}
          </span>
          <div className="text-sm text-muted-foreground">
            {block.property?.name || '-'}
          </div>
          <div className="text-sm text-muted-foreground">
            {block.distrikt || '-'}
          </div>
          <div className="text-sm">{block.blockReason}</div>
          <div className="text-sm text-muted-foreground">
            {formatISODate(block.fromDate)} - {formatISODate(block.toDate)}
          </div>
        </div>
        <span className="text-sm text-muted-foreground">
          {block.rentalObject?.category || '-'}
        </span>
      </div>
    </div>
  )
}
