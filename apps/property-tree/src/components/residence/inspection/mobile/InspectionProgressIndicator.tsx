import { Progress } from '@/components/ui/Progress'

interface InspectionProgressIndicatorProps {
  current: number
  total: number
  currentRoomName: string
}

export function InspectionProgressIndicator({
  current,
  total,
  currentRoomName,
}: InspectionProgressIndicatorProps) {
  const progress = (current / total) * 100

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{currentRoomName}</span>
        <span className="text-muted-foreground">
          {current}/{total} rum
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}
