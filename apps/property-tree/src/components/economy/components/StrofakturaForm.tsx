import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Calendar } from '@/components/ui/Calendar'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'
import { Card } from '@/components/ui/Card'
import { Separator } from '@/components/ui/Separator'
import { useToast } from '@/components/hooks/useToast'
import { TenantSearchSection } from './TenantSearchSection'
import { LeaseContractSection } from './LeaseContractSection'
import { ArticleSection } from './ArticleSection'
import { AdditionalInfoSection } from './AdditionalInfoSection'
import { InvoiceRow } from '../types'
import { TenantSearchResult } from '@/hooks/useTenantSearch'
import { useLeases } from '@/components/hooks/useLeases'
import { useUser } from '@/auth/useUser'

const strofakturaSchema = z.object({
  datum: z.date(),
  kundnummer: z.string().min(1, 'Kundnummer krävs'),
  kundnamn: z.string(),
  hyreskontrakt: z.string().min(1, 'Välj hyreskontrakt'),
  kst: z.string(),
  fastighet: z.string(),
  artikel: z.string().min(1, 'Välj artikel'),
  artikelnummer: z.string(),
  projekt: z.string().optional(),
  internInfo: z.string().max(255).optional(),
})

interface FormErrors {
  kundnummer?: string
  hyreskontrakt?: string
  artikel?: string
}

export function StrofakturaForm() {
  const userState = useUser()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  // Form state
  const [datum, setDatum] = useState<Date>(new Date())
  const [selectedTenant, setSelectedTenant] =
    useState<TenantSearchResult | null>(null)
  const { data, error, isLoading } = useLeases(selectedTenant?.contactCode)
  const [hyreskontrakt, setHyreskontrakt] = useState('')
  const [kst, setKst] = useState('')
  const [fastighet, setFastighet] = useState('')
  const [artikel, setArtikel] = useState('')
  const [artikelnummer, setArtikelnummer] = useState('')
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([
    { text: '', amount: 1, price: 0, articleId: '', articleName: '' },
  ])
  const [projekt, setProjekt] = useState('')
  const [internInfo, setInternInfo] = useState('')
  const [avserObjektnummer, setAvserObjektnummer] = useState('')
  const [administrativaKostnader, setAdministrativaKostnader] = useState(false)
  const [hanteringsavgift, setHanteringsavgift] = useState(false)

  const handleCustomerSelect = (tenant: TenantSearchResult | null) => {
    setSelectedTenant(tenant)
    if (tenant) {
      // Reset lease-related fields
      setHyreskontrakt('')
      setKst('')
      setFastighet('')
      setAvserObjektnummer('')
    } else {
      setHyreskontrakt('')
      setKst('')
      setFastighet('')
      setAvserObjektnummer('')
    }
    setErrors((prev) => ({ ...prev, kundnummer: undefined }))
  }

  useEffect(() => {}, [selectedTenant])

  const handleLeaseSelect = (leaseId: string) => {
    setHyreskontrakt(leaseId)
    const selectedLease = data?.find((l) => l.leaseId === leaseId)
    if (selectedLease) {
      // setKst(selectedLease.district)
      setFastighet(selectedLease?.residentialArea?.code ?? '')
      setAvserObjektnummer(selectedLease?.leaseId)
    }
    setErrors((prev) => ({ ...prev, hyreskontrakt: undefined }))
  }

  const validateForm = (): boolean => {
    const formData = {
      datum,
      kundnummer: selectedTenant?.contactCode,
      kundnamn: selectedTenant?.fullName,
      hyreskontrakt,
      kst,
      fastighet,
      artikel,
      artikelnummer,
      projekt,
      internInfo,
    }

    const result = strofakturaSchema.safeParse(formData)

    if (!result.success) {
      const newErrors: FormErrors = {}
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof FormErrors
        if (
          ['kundnummer', 'hyreskontrakt', 'artikel'].includes(field as string)
        ) {
          newErrors[field] = err.message
        }
      })
      setErrors(newErrors)
      return false
    }

    setErrors({})
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: 'Valideringsfel',
        description: 'Kontrollera de markerade fälten och försök igen.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Simulera API-anrop
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: 'Underlag sparat',
        description: `Ströfaktura-underlag för ${selectedTenant?.fullName} har skapats.`,
      })

      // Reset form
      handleReset()
    } catch (error) {
      toast({
        title: 'Fel',
        description: 'Kunde inte spara underlaget. Försök igen.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setDatum(new Date())
    setSelectedTenant(null)
    setHyreskontrakt('')
    setKst('')
    setFastighet('')
    setArtikel('')
    setArtikelnummer('')
    setInvoiceRows([
      { text: '', amount: 1, price: 0, articleId: '', articleName: '' },
    ])
    setProjekt('')
    setInternInfo('')
    setAvserObjektnummer('')
    setAdministrativaKostnader(false)
    setHanteringsavgift(false)
    setErrors({})
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        Nytt ströfaktura-underlag
        <div className="space-y-6">
          {/* Datum och Referens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label>Datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !datum && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {datum ? (
                      format(datum, 'PPP', { locale: sv })
                    ) : (
                      <span>Välj datum</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={datum}
                    onSelect={(date) => date && setDatum(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-3">
              <Label>Referens</Label>
              <Input
                value={
                  userState.tag === 'success'
                    ? userState.user.name
                    : 'Ej inloggad'
                }
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          <Separator />

          {/* Kundsektion */}
          <div className="space-y-4">
            <h3 className="font-medium">Kundinformation</h3>
            <TenantSearchSection
              value={selectedTenant?.contactCode}
              tenantName={selectedTenant?.fullName}
              onCustomerSelect={handleCustomerSelect}
              error={errors.kundnummer}
            />
          </div>

          <Separator />

          {/* Kontraktsektion */}
          <div className="space-y-4">
            <h3 className="font-medium">Kontraktsinformation</h3>
            <LeaseContractSection
              leaseContracts={data ?? []}
              selectedLease={hyreskontrakt}
              kst={kst}
              fastighet={fastighet}
              onLeaseSelect={handleLeaseSelect}
              error={errors.hyreskontrakt}
              disabled={!selectedTenant}
            />
          </div>

          <Separator />

          {/* Artikelsektion */}
          <div className="space-y-4">
            <h3 className="font-medium">Artikelinformation</h3>
            <ArticleSection
              artikelnummer={artikelnummer}
              avserObjektnummer={avserObjektnummer}
              invoiceRows={invoiceRows}
              administrativaKostnader={administrativaKostnader}
              hanteringsavgift={hanteringsavgift}
              onInvoiceRowsChange={setInvoiceRows}
              onAdministrativaKostnaderChange={setAdministrativaKostnader}
              onHanteringsavgiftChange={setHanteringsavgift}
              errors={{
                artikel: errors.artikel,
              }}
            />
          </div>

          <Separator />

          {/* Övrig information */}
          <div className="space-y-4">
            <h3 className="font-medium">Övrig information</h3>
            <AdditionalInfoSection
              projekt={projekt}
              internInfo={internInfo}
              onProjektChange={setProjekt}
              onInternInfoChange={setInternInfo}
            />
          </div>

          <Separator />

          {/* Knappar */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isSubmitting}
            >
              Rensa
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sparar...' : 'Spara underlag'}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  )
}
