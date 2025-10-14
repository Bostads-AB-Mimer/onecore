import { ResponsiveTable } from '@/components/ui/ResponsiveTable'

export function WorkOrdersTableSkeleton() {
  const skeletonRows = Array(5).fill(null)

  return (
    <div className="space-y-4">
      <ResponsiveTable
        data={skeletonRows}
        columns={[
          {
            key: 'id',
            label: 'Ärendenummer',
            render: () => (
              <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
            ),
          },
          {
            key: 'title',
            label: 'Ärende',
            render: () => (
              <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
            ),
          },
          {
            key: 'reportedDate',
            label: 'Skapad datum',
            render: () => (
              <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
            ),
            hideOnMobile: true,
          },
          {
            key: 'dueDate',
            label: 'Förfallodatum',
            render: () => (
              <div className="h-4 w-24 bg-slate-200 animate-pulse rounded" />
            ),
            hideOnMobile: true,
          },
          {
            key: 'status',
            label: 'Status',
            render: () => (
              <div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" />
            ),
          },
          {
            key: 'type',
            label: 'Typ',
            render: () => (
              <div className="h-4 w-16 bg-slate-200 animate-pulse rounded" />
            ),
            hideOnMobile: true,
          },
          {
            key: 'action',
            label: 'Åtgärd',
            render: () => (
              <div className="h-8 w-16 bg-slate-200 animate-pulse rounded" />
            ),
          },
        ]}
        keyExtractor={(index) => `skeleton-${index}`}
        mobileCardRenderer={() => (
          <div className="space-y-2 w-full">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
                <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
              </div>
              <div className="h-6 w-20 bg-slate-200 animate-pulse rounded-full" />
            </div>
            <div className="flex justify-end">
              <div className="h-8 w-16 bg-slate-200 animate-pulse rounded" />
            </div>
          </div>
        )}
      />
    </div>
  )
}
