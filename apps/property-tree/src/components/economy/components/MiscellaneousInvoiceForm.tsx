import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
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
import { economyService } from '@/services/api/core'
import { getArticleById } from '@/data/articles/MiscellaneousInvoiceArticles'
import { useMiscellaneousInvoiceDataForLease } from '@/components/hooks/useMiscellaneousInvoiceDataForLease'
import { Lease as CoreLease } from '@/services/api/core'
import { useRentalProperties } from '@/components/hooks/useRentalProperties'
import { useXledgerContacts } from '@/components/hooks/useXledgerContacts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { XledgerContact } from '@onecore/types'

interface FormErrors {
  contactCode?: string
  leaseId?: string
  articles?: string
}

export function MiscellaneousInvoiceForm() {
  const userState = useUser()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitInvoiceMutation = useMutation({
    mutationFn: async (invoice: MiscellaneousInvoicePayload) => {
      return await economyService.submitMiscellaneousInvoice(invoice)
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Underlag skickat',
        description: `Ströfaktura-underlag för ${variables.contactCode} har skickats.`,
      })
      handleReset()
    },
    onError: () => {
      toast({
        title: 'Fel',
        description: 'Kunde inte skicka underlaget. Försök igen.',
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setIsSubmitting(false)
    },
  })

  const { data: contacts, isLoading: isLoadingContacts } = useXledgerContacts()

  const [reference, setReference] = useState<XledgerContact | null>(null)

  useEffect(() => {
    if (userState.tag === 'success' && contacts) {
      setReference(
        contacts.find((c) => c.email === userState.user.email) ?? null
      )
    }
  }, [JSON.stringify(userState), contacts])

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

  const { data: rentalProperties } = useRentalProperties(
    leases?.map((l) => l.rentalPropertyId) || []
  )

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
    { price: 0, amount: 1, articleId: '', articleName: '' },
  ])
  const [projectCode, setProjectCode] = useState('')
  const [comment, setComment] = useState('')
  const [administrativeCosts, setAdministrativeCosts] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)

  const handleSelectContact = (dbId: string) => {
    const selectedContact = contacts?.find((c) => c.dbId === dbId)
    if (selectedContact) {
      setReference(selectedContact)
    }
  }

  const handleSelectTenant = (tenant: TenantSearchResult | null) => {
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
          amount: 1,
        })
      }
    }

    setIsSubmitting(true)

    // Prepare invoice payload
    const invoicePayload: MiscellaneousInvoicePayload = {
      reference: reference?.dbId || '',
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
      attachment: attachedFile ?? undefined,
    }

    submitInvoiceMutation.mutate(invoicePayload)
  }

  const handleReset = () => {
    setInvoiceDate(new Date())
    setSelectedTenant(null)
    setLeaseId('')
    setSelectedLease(null)
    setInvoiceRows([
      { price: 0, amount: 1, articleId: '', articleName: '', text: '' },
    ])
    setProjectCode('')
    setComment('')
    setAdministrativeCosts(false)
    setErrors({})

    // Wait a tick before scrolling up since other page updates can interfere with the scroll
    setTimeout(() => {
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
    }, 0)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        Nytt ströfaktura-underlag
        <div className="space-y-6">
          {/* Datum och Referens */}
          <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
            <div className="space-y-3">
              <Label>Referens</Label>
              {isLoadingContacts ? (
                <div>Laddar kontakter...</div>
              ) : (
                <Select
                  value={reference?.dbId}
                  onValueChange={(dbId) => handleSelectContact(dbId)}
                >
                  <SelectTrigger id="contact">
                    <SelectValue placeholder="Välj referens" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts?.map((contact) => (
                      <SelectItem key={contact.dbId} value={contact.dbId}>
                        {contact.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <Separator />

          {/* Kundsektion */}
          <div className="space-y-4">
            <h3 className="font-medium">Kundinformation</h3>
            <TenantSearchSection
              tenantName={selectedTenant?.fullName}
              onSelectTenant={handleSelectTenant}
              error={errors.contactCode}
            />
          </div>

          <Separator />

          {/* Kontraktsektion */}
          <div className="space-y-4">
            <h3 className="font-medium">Kontraktsinformation</h3>
            <LeaseContractSection
              leaseContracts={leases ?? []}
              rentalProperties={rentalProperties}
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
              onInvoiceRowsChange={setInvoiceRows}
              onAdministrativaKostnaderChange={setAdministrativeCosts}
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
                ? 'Skickar...'
                : 'Skicka underlag'}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  )
}
