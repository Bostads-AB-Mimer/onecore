import { Avatar, AvatarFallback } from '@/shared/ui/Avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/Card'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

import { useInspectors } from '../hooks/useInspectors'

interface InspectionDetailsCardProps {
  inspectorName: string
  setInspectorName: (name: string) => void
}

const getInitials = (name: string): string =>
  name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')

export function InspectionDetailsCard({
  inspectorName,
  setInspectorName,
}: InspectionDetailsCardProps) {
  const { data: inspectors, isLoading: isLoadingInspectors } = useInspectors()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Info om besiktning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Besiktigare</Label>
          <Select value={inspectorName} onValueChange={setInspectorName}>
            <SelectTrigger className="w-full" disabled={isLoadingInspectors}>
              <SelectValue placeholder="Välj besiktigare">
                {inspectorName && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(inspectorName)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{inspectorName}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {inspectors?.map((user) => {
                const name = `${user.firstName} ${user.lastName}`
                return (
                  <SelectItem key={user.id} value={name}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      {name}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
