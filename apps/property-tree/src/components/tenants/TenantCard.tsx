import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/v2/Card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v2/Collapsible'
import {
  Phone,
  Mail,
  MessageSquare,
  User,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useIsMobile } from '@/components/hooks/useMobile'
import type { Tenant } from '@/services/types'
import { CopyableField } from '@/components/ui/CopyableField'
import { TooltipProvider } from '@/components/ui/Tooltip'

interface TenantCardProps {
  tenant: Tenant
}

export function TenantCard({ tenant }: TenantCardProps) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)

  // const handleCall = () => {
  //   window.location.href = `tel:${tenant.phone.replace(/[\s-]/g, '')}`
  // }

  // const handleSMS = () => {
  //   window.location.href = `sms:${tenant.phone.replace(/[\s-]/g, '')}`
  // }

  // const handleEmail = () => {
  //   window.location.href = `mailto:${tenant.email}`
  // }

  // Format personal number to P-number format
  const formatPersonalNumber = (personalNumber: string) => {
    const numbersOnly = personalNumber.replace(/\D/g, '')
    const lastSixDigits = numbersOnly.slice(-6)
    return `P${lastSixDigits.padStart(6, '0')}`
  }

  // Build address string from compound address object
  const formatAddress = (address: {
    street: string
    number: string
    postalCode: string
    city: string
  }) => {
    const streetPart = address.number?.trim()
      ? `${address.street} ${address.number.trim()}`
      : address.street
    return `${streetPart}, ${address.postalCode} ${address.city}`
  }

  // Map contract status number to Swedish text
  const getContractStatusText = (status: number) => {
    switch (status) {
      case 0:
        return 'Gällande'
      case 1:
        return 'Kommande'
      case 2:
        return 'Uppsagt, kommer att upphöra'
      case 3:
        return 'Uppsagt'
      default:
        return 'Okänd status'
    }
  }

  // Get main phone number or first available
  const getDisplayPhoneNumber = () => {
    if (!tenant.phoneNumbers || tenant.phoneNumbers.length === 0) {
      return ''
    }
    const mainPhone = tenant.phoneNumbers.find(
      (phone) => phone.isMainNumber === 1
    )
    return mainPhone
      ? mainPhone.phoneNumber
      : tenant.phoneNumbers[0].phoneNumber
  }

  const cardContent = (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <CopyableField
            label="Namn"
            value={`${tenant.firstName} ${tenant.lastName}`}
          />

          <CopyableField
            label="Personnummer"
            value={tenant.nationalRegistrationNumber}
          />

          <CopyableField
            label="Bostadsadress"
            value={formatAddress(tenant.address)}
          />

          <CopyableField label="Kundnummer" value={tenant.contactCode} />
        </div>

        <div className="space-y-4">
          <CopyableField label="E-post" value={tenant.emailAddress} />

          <div>
            <p className="text-sm text-muted-foreground">Telefon</p>
            <div className="space-y-2">
              {tenant.phoneNumbers && tenant.phoneNumbers.length > 0 ? (
                tenant.phoneNumbers.map((phone, index) => (
                  <CopyableField
                    key={index}
                    label={phone.type || 'Telefon'}
                    value={phone.phoneNumber}
                  />
                ))
              ) : (
                <p className="font-medium">Ej angivet</p>
              )}
            </div>
          </div>
          {/* Later
        - type/role of the user (boende/sökande)
        - has legal guardian status
        will be shown here */}
        </div>

        {/* <div className="space-y-4">
        Later
        - Mina sidor & related information
        will be shown here
      </div> */}
      </div>
    </TooltipProvider>
  )

  if (isMobile) {
    return (
      <Card>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <div className="w-full cursor-pointer">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {/*
                     We cannot determine the customerType/role yet
                     <CardTitle className="text-left">
                      {tenant.customerType === 'tenant'
                        ? 'Hyresgäst'
                        : 'Sökande'}
                    </CardTitle> */}
                    <div className="space-y-1 mt-2">
                      <p className="text-sm font-medium">
                        {formatAddress(tenant.address)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {tenant.contactCode} • {getDisplayPhoneNumber()}
                      </p>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border mx-6 mb-4"></div>
            <CardContent>{cardContent}</CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        {/*
        We cannot determine the customerType/role yet 
        <CardTitle>
          {tenant.customerType === 'tenant' ? 'Hyresgäst' : 'Sökande'}
        </CardTitle> */}
      </CardHeader>
      <CardContent>{cardContent}</CardContent>
    </Card>
  )
}
