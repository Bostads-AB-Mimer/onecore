import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/v2/Button'
import { Badge } from '@/components/ui/v3/Badge'
import { Label } from '@/components/ui/Label'
import { User, MapPin, ExternalLink, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Tenant } from '@/services/types'

interface InspectorSelectionCardProps {
  inspectorName: string
  setInspectorName: (name: string) => void
  inspectionTime: string
  setInspectionTime: (time: string) => void
  needsMasterKey: boolean
  setNeedsMasterKey: (needs: boolean) => void
  tenant?: Tenant
  layout?: 'vertical' | 'horizontal'
}

const inspectors = [
  'Anna Andersson',
  'Erik Eriksson',
  'Maria Nilsson',
  'Johan Johansson',
]

// Simulate logged in user
const currentUser = 'Anna Andersson'

export function InspectorSelectionCard({
  inspectorName,
  setInspectorName,
  inspectionTime,
  setInspectionTime,
  needsMasterKey,
  setNeedsMasterKey,
  tenant,
  layout = 'vertical',
}: InspectorSelectionCardProps) {
  const navigate = useNavigate()

  // Set default inspector if not already set
  useEffect(() => {
    if (!inspectorName && currentUser) {
      setInspectorName(currentUser)
    }
  }, [inspectorName, setInspectorName])

  const handleOpenTenantProfile = () => {
    if (tenant?.contactCode) {
      navigate(`/tenants/${tenant.contactCode}`)
    }
  }

  const isHorizontal = layout === 'horizontal'

  return (
    <div
      className={cn(
        isHorizontal ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-4'
      )}
    >
      {/* Tenant Info Card */}
      {tenant && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Hyresgäst</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenTenantProfile}
                className="h-8 px-2"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {/* <AvatarImage src={tenant.avatar} /> TODO: does this even exist? */}
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-base">{tenant.fullName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Inflyttningsdatum</p>
                <p className="font-medium">
                  {/* {tenant.moveInDate || '2023-01-15'} Field does not exist on tenant. Need to get leases if this is mean to be displayed in final design. */}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Utflyttningsdatum</p>
                <p className="font-medium">
                  {/* {tenant.moveOutDate || '-'}  Field does not exist on tenant. Need to get leases if this is mean to be displayed in final design. */}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Odenplan 5, lägenhet 1001</span>
              </div>
              <Badge
                variant="outline"
                className="bg-orange-50 text-orange-700 border-orange-200"
              >
                Uppsagt
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inspector Selection and Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Info om besiktning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Besiktigare</Label>
            <Select value={inspectorName} onValueChange={setInspectorName}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Välj besiktigare">
                  {inspectorName && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {inspectorName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span>{inspectorName}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {inspectors.map((inspector) => (
                  <SelectItem key={inspector} value={inspector}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {inspector
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      {inspector}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Klockslag
            </Label>
            <Select
              value={inspectionTime || '09:00'}
              onValueChange={setInspectionTime}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Välj tid" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, hour) =>
                  ['00', '15', '30', '45'].map((minute) => {
                    const time = `${hour.toString().padStart(2, '0')}:${minute}`
                    return (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    )
                  })
                ).flat()}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
