import { Card, CardContent, CardHeader } from '@/shared/ui/Card'

export function WorkOrderCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex flex-col space-y-2 flex-1">
            <div className="h-5 bg-slate-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-slate-200 rounded animate-pulse w-1/3" />
          </div>
          <div className="h-6 w-16 bg-slate-200 rounded-full animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded animate-pulse w-1/4" />
          <div className="text-xs space-y-1.5">
            <div className="h-3 bg-slate-200 rounded animate-pulse w-2/3" />
            <div className="h-3 bg-slate-200 rounded animate-pulse w-1/2" />
            <div className="h-3 bg-slate-200 rounded animate-pulse w-3/5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
