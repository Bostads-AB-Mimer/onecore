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
import { Badge } from '@/components/ui/v2/Badge'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { User, MapPin, ExternalLink, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

interface InspectorSelectionCardProps {
  inspectorName: string
  setInspectorName: (name: string) => void
  inspectionTime: string
  setInspectionTime: (time: string) => void
  needsMasterKey: boolean
  setNeedsMasterKey: (needs: boolean) => void
  tenant?: any
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
}: InspectorSelectionCardProps) {
  const navigate = useNavigate()

  // Set default inspector if not already set
  useEffect(() => {
    if (!inspectorName && currentUser) {
      setInspectorName(currentUser)
    }
  }, [inspectorName, setInspectorName])

  const handleOpenTenantProfile = () => {
    if (tenant?.id) {
      navigate(`/tenants/${tenant.id}`)
    }
  }

  return (
    <div className="space-y-4">
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
                <AvatarImage src={tenant.avatar} />
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-base">
                  {tenant.name ||
                    [tenant.firstName, tenant.lastName]
                      .filter(Boolean)
                      .join(' ')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Inflyttningsdatum</p>
                <p className="font-medium">
                  {tenant.moveInDate || '2023-01-15'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Utflyttningsdatum</p>
                <p className="font-medium">{tenant.moveOutDate || '-'}</p>
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
        <CardContent className="space-y-6">
          <Select value={inspectorName} onValueChange={setInspectorName}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Välj vem som utför besiktningen" />
            </SelectTrigger>
            <SelectContent>
              {inspectors.map((inspector) => (
                <SelectItem key={inspector} value={inspector}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
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

          <div className="space-y-3">
            <Label
              htmlFor="inspection-time"
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Klockslag för besiktning
            </Label>
            <div className="flex gap-2">
              <Select
                value={inspectionTime.split(':')[0] || '09'}
                onValueChange={(hour) => {
                  const currentMinute = inspectionTime.split(':')[1] || '00'
                  setInspectionTime(`${hour}:${currentMinute}`)
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Timme" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) =>
                    i.toString().padStart(2, '0')
                  ).map((hour) => (
                    <SelectItem key={hour} value={hour}>
                      {hour}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="flex items-center px-2 text-muted-foreground">
                :
              </span>
              <Select
                value={inspectionTime.split(':')[1] || '00'}
                onValueChange={(minute) => {
                  const currentHour = inspectionTime.split(':')[0] || '09'
                  setInspectionTime(`${currentHour}:${minute}`)
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Minut" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) =>
                    (i * 5).toString().padStart(2, '0')
                  ).map((minute) => (
                    <SelectItem key={minute} value={minute}>
                      {minute}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Huvudnyckel</span>
            <span className="text-sm text-muted-foreground">Nej</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
