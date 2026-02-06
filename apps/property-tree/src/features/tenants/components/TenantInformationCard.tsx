import {
  ChevronDown,
  Mail,
  MessageSquare,
  Phone,
  FileText,
  StickyNote,
} from 'lucide-react'
import { Button } from '@/components/ui/v2/Button'
import { Card, CardContent } from '@/components/ui/v2/Card'
import { Badge } from '@/components/ui/v2/Badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion'
import { Separator } from '@/components/ui/v2/Separator'
import { useState } from 'react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v2/Tabs'
import { TabLayout } from '@/components/ui/TabLayout'
import { Notes } from '@/components/shared/Notes'

interface TenantInformationCardProps {
  tenant:
    | {
        firstName: string
        lastName: string
        phone: string
        email: string
        contractStatus: 'permanent' | 'temporary' | 'terminated'
        moveInDate: string
        moveOutDate?: string
        personalNumber?: string
        isPrimaryTenant?: boolean
        relationshipType?: string
      }
    | Array<{
        firstName: string
        lastName: string
        phone: string
        email: string
        contractStatus: 'permanent' | 'temporary' | 'terminated'
        moveInDate: string
        moveOutDate?: string
        personalNumber?: string
        isPrimaryTenant?: boolean
        relationshipType?: string
      }>
  displayMode?: 'full' | 'compact'
}

export function TenantInformationCard({
  tenant,
  displayMode = 'full',
}: TenantInformationCardProps) {
  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone.replace(/[\s-]/g, '')}`
  }

  const handleSMS = (phone: string) => {
    window.location.href = `sms:${phone.replace(/[\s-]/g, '')}`
  }

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`
  }

  // Format contract status in Swedish
  const getContractStatus = (status: string) => {
    switch (status) {
      case 'permanent':
        return 'Tillsvidare'
      case 'temporary':
        return 'Andrahandsuthyrning'
      case 'terminated':
        return 'Uppsagt'
      default:
        return status
    }
  }

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'permanent':
        return 'outline'
      case 'temporary':
        return 'outline'
      case 'terminated':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  // Check if we have multiple tenants
  const isMultipleTenants = Array.isArray(tenant)
  const tenants = isMultipleTenants ? tenant : [tenant]

  // Check if this is actually a second-hand rental (has temporary contract status)
  const isSecondHandRental = tenants.some(
    (t) => t.contractStatus === 'temporary'
  )

  // For compact mode, show all tenants but with limited info for secondary tenant
  const tenantsToShow = tenants

  const renderTenantInfo = (tenantData: (typeof tenants)[0], index: number) => {
    const isSecondaryTenant = tenantData.contractStatus === 'temporary'
    const showCompactInfo = displayMode === 'compact'

    return (
      <div key={index} className="space-y-4">
        {isMultipleTenants && (
          <div className="mb-3">
            <h4 className="font-medium text-base">
              {tenantData.contractStatus === 'temporary'
                ? 'Andrahandsuthyrning'
                : tenantData.isPrimaryTenant
                  ? 'Kontraktsinnehavare'
                  : 'Hyresgäst'}
            </h4>
          </div>
        )}

        <div>
          <p className="text-sm text-muted-foreground">Namn</p>
          <p className="font-medium">
            {tenantData.firstName} {tenantData.lastName}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Kontraktstatus</p>
          <p className="font-medium">
            {getContractStatus(tenantData.contractStatus)}
          </p>
        </div>

        {/* Show personal number only for primary tenants (not second-hand tenants) */}
        {tenantData.personalNumber && !isSecondaryTenant && (
          <div>
            <p className="text-sm text-muted-foreground">Personnummer</p>
            <p className="font-medium">{tenantData.personalNumber}</p>
          </div>
        )}

        {/* Contact information */}
        <div>
          <p className="text-sm text-muted-foreground">Telefon</p>
          <div className="flex items-center gap-2">
            <p className="font-medium">{tenantData.phone}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCall(tenantData.phone)}
                title="Ring"
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleSMS(tenantData.phone)}
                title="Skicka SMS"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">E-post</p>
          <div className="flex items-center gap-2">
            <p className="font-medium">{tenantData.email}</p>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleEmail(tenantData.email)}
              title="Skicka e-post"
            >
              <Mail className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contract information */}
        <div>
          <p className="text-sm text-muted-foreground">Inflyttningsdatum</p>
          <p className="font-medium">
            {new Date(tenantData.moveInDate).toLocaleDateString('sv-SE')}
          </p>
        </div>

        {tenantData.moveOutDate && (
          <div>
            <p className="text-sm text-muted-foreground">Utflyttningsdatum</p>
            <p className="font-medium">
              {new Date(tenantData.moveOutDate).toLocaleDateString('sv-SE')}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="tenant-info">
        <AccordionTrigger className="px-3 sm:px-4 py-3 hover:bg-accent/50">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-lg">Hyresgästinformation</h3>
            {isSecondHandRental && (
              <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
              >
                Andrahandsuthyrning
              </Badge>
            )}
          </div>
        </AccordionTrigger>

        <AccordionContent>
          <div className="px-4 pb-4">
            <Tabs defaultValue="info" className="space-y-6">
              <TabsList className="bg-slate-100/70 p-1 rounded-lg overflow-x-auto">
                <TabsTrigger value="info">Information</TabsTrigger>
                <TabsTrigger value="notes">Noteringar</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <TabLayout title="Information" showCard={true}>
                  <div className="space-y-6">
                    {tenantsToShow.map((tenantData, index) => (
                      <div key={index}>
                        {renderTenantInfo(tenantData, index)}
                        {index < tenantsToShow.length - 1 && (
                          <Separator className="my-6" />
                        )}
                      </div>
                    ))}
                  </div>
                </TabLayout>
              </TabsContent>

              <TabsContent value="notes">
                <TabLayout title="Noteringar" showCard={true}>
                  <Notes
                    entityType="tenant"
                    entityId="current-tenant"
                    placeholder="Skriv din notering här..."
                    emptyMessage="Inga noteringar har lagts till för denna hyresgäst ännu."
                  />
                </TabLayout>
              </TabsContent>
            </Tabs>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
