import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
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
import { InvoiceRow, MiscellaneousInvoicePayload } from '../types'
import { TenantSearchResult } from '@/hooks/useTenantSearch'
import { useLeases } from '@/components/hooks/useLeases'
import { useUser } from '@/auth/useUser'
import { economyService } from '@/services/api/core/economyService'
import { getArticleById } from '@/data/articles/MiscellaneousInvoiceArticles'
import { useMiscellaneousInvoiceDataForLease } from '@/components/hooks/useMiscellaneousInvoiceDataForLease'
import { Lease as CoreLease } from '@/services/api/core'

interface FormErrors {
  contactCode?: string
  leaseId?: string
  articles?: string
}

export function MiscellaneousInvoiceForm() {
  const userState = useUser()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Mutation for submitting the invoice
  const submitInvoiceMutation = useMutation({
    mutationFn: async (invoice: MiscellaneousInvoicePayload) => {
      return await economyService.submitMiscellaneousInvoice(invoice)
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Underlag sparat',
        description: `Ströfaktura-underlag för ${variables.contactCode} har skapats.`,
      })
      // handleReset()
    },
    onError: () => {
      toast({
        title: 'Fel',
        description: 'Kunde inte spara underlaget. Försök igen.',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setIsSubmitting(false)
    },
  })
  const [errors, setErrors] = useState<FormErrors>({})

  // Form state
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date())
  const [selectedTenant, setSelectedTenant] =
    useState<TenantSearchResult | null>(null)
  const {
    data: leases,
    error: leasesError,
    isLoading: leasesIsLoading,
  } = useLeases(selectedTenant?.contactCode)

  const [leaseId, setLeaseId] = useState<string | null>(null)
  const [selectedLease, setSelectedLease] = useState<CoreLease | null>(null)

  const {
    data: miscellaneousInvoiceDataForLease,
    error: miscellaneousInvoiceDataForLeaseError,
    isLoading: miscellaneousInvoiceDataForLeaseIsLoading,
  } = useMiscellaneousInvoiceDataForLease(selectedLease?.leaseId)

  const [costCentre, setCostCentre] = useState<string | undefined>(
    miscellaneousInvoiceDataForLease?.costCentre
  )
  const [propertyCode, setPropertyCode] = useState<string | undefined>(
    miscellaneousInvoiceDataForLease?.propertyCode
  )

  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([
    { price: 0, articleId: '', articleName: '' },
  ])
  const [projectCode, setProjectCode] = useState('')
  const [comment, setComment] = useState('')
  const [administrativeCosts, setAdministrativeCosts] = useState(false)
  const [handlingFee, setHandlingFee] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)

  const handleCustomerSelect = (tenant: TenantSearchResult | null) => {
    setSelectedTenant(tenant)
    setLeaseId(null)
    setCostCentre(undefined)
    setPropertyCode(undefined)
    setErrors((prev) => ({ ...prev, contactCode: undefined }))
  }

  const handleLeaseSelect = (leaseId: string) => {
    setLeaseId(leaseId)
    const lease = leases?.find((l) => l.leaseId === leaseId)
    if (lease) {
      setSelectedLease(lease)
    }
    setErrors((prev) => ({ ...prev, leaseId: undefined }))
  }

  const handleCostCentreChange = (value: string) => {
    setCostCentre(value)
  }

  const handlePropertyCodeChange = (value: string) => {
    setPropertyCode(value)
  }

  useEffect(() => {
    setCostCentre(miscellaneousInvoiceDataForLease?.costCentre)
    setPropertyCode(miscellaneousInvoiceDataForLease?.propertyCode)
  }, [miscellaneousInvoiceDataForLease])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!selectedTenant) {
      newErrors.contactCode = 'Kund måste väljas'
    }

    if (!leaseId) {
      newErrors.leaseId = 'Hyreskontrakt måste väljas'
    }

    const hasValidInvoiceRows = invoiceRows.some(
      (row) => row.articleId !== '' && row.price !== 0
    )
    if (!hasValidInvoiceRows) {
      newErrors.articles = 'Minst en artikel eller tjänst måste läggas till'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: 'Valideringsfel',
        description: 'Kontrollera de markerade fälten och försök igen.',
        variant: 'destructive',
      })
      return
    }

    const rows = [...invoiceRows]
    if (administrativeCosts) {
      const article = getArticleById('329000')
      if (article) {
        rows.push({
          articleId: article.id,
          articleName: article.name,
          price: article.standardPrice,
        })
      }
    }
    if (handlingFee) {
      const article = getArticleById('329001')
      if (article) {
        rows.push({
          articleId: article.id,
          articleName: article.name,
          price: article.standardPrice,
        })
      }
    }

    setIsSubmitting(true)

    // Prepare invoice payload
    const invoicePayload: MiscellaneousInvoicePayload = {
      invoiceDate: invoiceDate,
      contactCode: selectedTenant?.contactCode ?? '',
      tenantName: selectedTenant?.fullName ?? '',
      leaseId: leaseId ?? '',
      costCentre: costCentre ?? '',
      propertyCode: propertyCode ?? '',
      projectCode: projectCode,
      comment: comment,
      invoiceRows: rows,
      administrativeCosts: administrativeCosts,
      handlingFee: handlingFee,
      attachment: attachedFile ?? undefined,
    }

    submitInvoiceMutation.mutate(invoicePayload)
  }

  const handleReset = () => {
    setInvoiceDate(new Date())
    setSelectedTenant(null)
    setLeaseId('')
    setSelectedLease(null)
    setInvoiceRows([{ price: 0, articleId: '', articleName: '' }])
    setProjectCode('')
    setComment('')
    setAdministrativeCosts(false)
    setHandlingFee(false)
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
                      !invoiceDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {invoiceDate ? (
                      format(invoiceDate, 'PPP', { locale: sv })
                    ) : (
                      <span>Välj datum</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={invoiceDate}
                    onSelect={(date) => date && setInvoiceDate(date)}
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
              error={errors.contactCode}
            />
          </div>

          <Separator />

          {/* Kontraktsektion */}
          <div className="space-y-4">
            <h3 className="font-medium">Kontraktsinformation</h3>
            <LeaseContractSection
              leaseContracts={leases ?? []}
              selectedLease={leaseId}
              costCentre={costCentre}
              propertyCode={propertyCode}
              onLeaseSelect={handleLeaseSelect}
              onCostCentreChange={handleCostCentreChange}
              onPropertyCodeChange={handlePropertyCodeChange}
              error={errors.leaseId}
              disabled={!selectedTenant}
            />
          </div>

          <Separator />

          {/* Artikelsektion */}
          <div className="space-y-4">
            <h3 className="font-medium">Artikelinformation</h3>
            <ArticleSection
              invoiceRows={invoiceRows}
              administrativaKostnader={administrativeCosts}
              hanteringsavgift={handlingFee}
              onInvoiceRowsChange={setInvoiceRows}
              onAdministrativaKostnaderChange={setAdministrativeCosts}
              onHanteringsavgiftChange={setHandlingFee}
              errors={{
                articles: errors.articles,
              }}
            />
          </div>

          <Separator />

          {/* Övrig information */}
          <div className="space-y-4">
            <h3 className="font-medium">Övrig information</h3>
            <AdditionalInfoSection
              projekt={projectCode}
              internInfo={comment}
              onProjektChange={setProjectCode}
              onInternInfoChange={setComment}
              onFileAttached={setAttachedFile}
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
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                submitInvoiceMutation.isPending ||
                !selectedTenant ||
                !leaseId
              }
            >
              {isSubmitting || submitInvoiceMutation.isPending
                ? 'Sparar...'
                : 'Spara underlag'}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  )
}
