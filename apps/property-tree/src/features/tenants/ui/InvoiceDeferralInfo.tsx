import { Invoice } from '@onecore/types'

import { getInvoiceDeferralSummaryLines } from '../lib/invoiceDeferral'

type Props = {
  deferral: NonNullable<Invoice['deferral']>
}

export const InvoiceDeferralInfo = ({ deferral }: Props) => {
  const lines = getInvoiceDeferralSummaryLines(deferral)

  return (
    <div className="mb-3 text-sm bg-background/50 rounded p-2 space-y-1">
      <div className="font-medium">Anstånd</div>
      {lines.map((line) => (
        <div key={line.label}>
          <span className="font-medium">{line.label}:</span> {line.value}
        </div>
      ))}
    </div>
  )
}
