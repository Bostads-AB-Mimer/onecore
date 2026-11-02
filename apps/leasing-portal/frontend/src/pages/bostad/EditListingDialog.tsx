import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@onecore/ui'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { useLeasingHost } from '../../host/useLeasingHost'

import { useUpdateListing } from './useUpdateListing'
import type { VacantApartment } from './useVacantApartments'

interface ListingFormValues {
  publishedTo: Date | undefined
  publishUntilFurtherNotice: boolean
  availableFrom: Date | undefined
  tentativeAvailableFrom: Date | undefined
  reviewed: boolean
}

interface EditListingDialogProps {
  apartment: VacantApartment | null
  onClose: () => void
}

const formatAddress = (address: VacantApartment['address']) =>
  address?.street ?? '–'

const formatDate = (value: string | null | undefined) =>
  value ? format(new Date(value), 'd MMMM yyyy', { locale: sv }) : '–'

// Date-only (no time-of-day), so z.coerce.date() parses it as UTC midnight for
// the picked calendar day — toISOString() would instead shift the day back by
// the local UTC offset (e.g. a day earlier in Swedish timezones).
const toDateOnlyString = (date: Date) => format(date, 'yyyy-MM-dd')

const defaultValues = (apartment: VacantApartment): ListingFormValues => ({
  publishedTo: apartment.listing?.publishedTo
    ? new Date(apartment.listing.publishedTo)
    : undefined,
  // No publishedTo means "no end date" — same meaning as NON_SCORED parking
  // space listings elsewhere in the app (see useCreateMultipleListings.ts),
  // regardless of whether that's because the officer chose "tillsvidare" or
  // because the listing hasn't had an end date set at all yet.
  publishUntilFurtherNotice: !apartment.listing?.publishedTo,
  // availableFrom overrides the computed vacantFrom when set; prefill with
  // the override if one exists, otherwise the computed value (as before).
  availableFrom: apartment.listing?.availableFrom
    ? new Date(apartment.listing.availableFrom)
    : apartment.vacantFrom
      ? new Date(apartment.vacantFrom)
      : undefined,
  tentativeAvailableFrom: apartment.listing?.tentativeAvailableFrom
    ? new Date(apartment.listing.tentativeAvailableFrom)
    : undefined,
  reviewed: !!apartment.listing?.reviewedAt,
})

/**
 * Create/edit dialog for a listing's "Grundläggande" tab. The other three
 * tabs (Detaljerad beskrivning, Media, Planritning) are still placeholders
 * on the design — see UTH-354.
 */
export function EditListingDialog({
  apartment,
  onClose,
}: EditListingDialogProps) {
  const { user } = useLeasingHost()
  const updateListing = useUpdateListing()
  const form = useForm<ListingFormValues>({
    // apartment is only ever null before the early `return null` below, so
    // this initializer never actually needs a no-apartment fallback — the
    // mount-time useEffect reset() is what populates the form for real.
    defaultValues: apartment ? defaultValues(apartment) : undefined,
  })

  useEffect(() => {
    if (apartment) form.reset(defaultValues(apartment))
  }, [apartment, form])

  if (!apartment) return null

  const publishUntilFurtherNotice = form.watch('publishUntilFurtherNotice')

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  const onSubmit = (values: ListingFormValues) => {
    // No listing exists yet to edit — creating one is a separate flow, not
    // built here (the menu item that opens this dialog is disabled until then).
    if (!apartment.listing) return

    const alreadyPublished = !!apartment.listing.publishedFrom

    // Only persist availableFrom as an override when it actually diverges
    // from the computed vacantFrom — otherwise every save would freeze a
    // stale snapshot of the computed value as a permanent override.
    const computedVacantFrom = apartment.vacantFrom
      ? new Date(apartment.vacantFrom).getTime()
      : null
    const availableFromChanged =
      (values.availableFrom?.getTime() ?? null) !== computedVacantFrom

    updateListing.mutate(
      {
        listingId: apartment.listing.id,
        // "Publicera till" is only actually editable while still a draft;
        // once published it's shown disabled, so leave it untouched here.
        ...(!alreadyPublished && {
          publishedTo: values.publishUntilFurtherNotice
            ? null
            : (values.publishedTo
                ? toDateOnlyString(values.publishedTo)
                : null),
        }),
        availableFrom: availableFromChanged
          ? (values.availableFrom
              ? toDateOnlyString(values.availableFrom)
              : null)
          : null,
        tentativeAvailableFrom: values.tentativeAvailableFrom
          ? toDateOnlyString(values.tentativeAvailableFrom)
          : null,
        reviewedAt: values.reviewed
          ? (apartment.listing.reviewedAt ?? new Date().toISOString())
          : null,
        reviewedBy: values.reviewed
          ? (apartment.listing.reviewedBy ??
            [user.email, user.name, user.id].find(Boolean))
          : null,
      },
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redigera Annons</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Redigera detaljer för {formatAddress(apartment.address)}
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="grundlaggande">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="grundlaggande">Grundläggande</TabsTrigger>
                <TabsTrigger value="beskrivning">
                  Detaljerad beskrivning
                </TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="planritning">Planritning</TabsTrigger>
              </TabsList>

              <TabsContent
                value="grundlaggande"
                className="min-h-[520px] space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Grundläggande information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field
                      label="Adress"
                      value={formatAddress(apartment.address)}
                    />
                    <Field label="Nummer" value={apartment.apartmentNumber} />
                    <Field label="Område" value={apartment.marketAreaName} />
                    <Field label="Rum" value={apartment.roomCount} />
                    <Field
                      label="Yta"
                      value={
                        apartment.area != null
                          ? `${apartment.area}m²`
                          : undefined
                      }
                    />
                    <Field
                      label="Hiss"
                      value={
                        apartment.elevator == null
                          ? undefined
                          : apartment.elevator
                            ? 'Ja'
                            : 'Nej'
                      }
                    />
                    <Field
                      label="Hyra/månad"
                      value={`${Math.round(apartment.rent).toLocaleString('sv-SE')}kr/mån`}
                    />
                    <Field
                      label="Byggnadsår"
                      value={apartment.constructionYear ?? undefined}
                    />
                    <Field
                      label="Objektsnummer"
                      value={apartment.rentalObjectCode}
                    />
                    {/* No backing field yet — which inspection concept this
                        means (Fastighet-level Xpand date, or the per-residence
                        inspection-service protocol) still needs confirming. */}
                    <Field label="Besiktning genomförd" />
                  </CardContent>
                </Card>

                {/* Per the ticket: "Publicera från" is removed from this view
                    entirely (not shown disabled either) while still a draft;
                    once published, show the actual date as plain text. */}
                {apartment.listing?.publishedFrom ? (
                  <Field
                    label="Publicerad från"
                    value={formatDate(apartment.listing.publishedFrom)}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="publishedTo"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Publicera till</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={publishUntilFurtherNotice}
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {publishUntilFurtherNotice
                                  ? 'Tillsvidare'
                                  : field.value
                                    ? format(field.value, 'd MMMM yyyy', {
                                        locale: sv,
                                      })
                                    : 'Välj slutdatum'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                            />
                          </PopoverContent>
                        </Popover>
                      </FormItem>
                    )}
                  />
                )}

                {!apartment.listing?.publishedFrom && (
                  <FormField
                    control={form.control}
                    name="publishUntilFurtherNotice"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked)
                              if (checked)
                                form.setValue('publishedTo', undefined)
                            }}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">
                          Publicera tillsvidare (inget slutdatum)
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Prefilled with the computed vacantFrom (AVTAL-343); saving
                      without changing it keeps relying on that computed value
                      instead of freezing it as a permanent override. */}
                  <FormField
                    control={form.control}
                    name="availableFrom"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Tillgänglig från</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value
                                  ? format(field.value, 'd MMMM yyyy', {
                                      locale: sv,
                                    })
                                  : 'Välj datum'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                            />
                          </PopoverContent>
                        </Popover>
                      </FormItem>
                    )}
                  />
                  {/* No computed fallback — an unconfirmed earlier move-out
                      date. */}
                  <FormField
                    control={form.control}
                    name="tentativeAvailableFrom"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Eventuellt tillgänglig från</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value
                                  ? format(field.value, 'd MMMM yyyy', {
                                      locale: sv,
                                    })
                                  : 'Välj datum'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                            />
                          </PopoverContent>
                        </Popover>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="beskrivning" className="min-h-[520px]">
                <p className="py-8 text-center text-muted-foreground">
                  Innehåll kommer
                </p>
              </TabsContent>
              <TabsContent value="media" className="min-h-[520px]">
                <p className="py-8 text-center text-muted-foreground">
                  Innehåll kommer
                </p>
              </TabsContent>
              <TabsContent value="planritning" className="min-h-[520px]">
                <p className="py-8 text-center text-muted-foreground">
                  Innehåll kommer
                </p>
              </TabsContent>
            </Tabs>

            {/* Outside the tab panels so it stays visible — and savable —
                regardless of which tab is active, matching the design. */}
            <FormField
              control={form.control}
              name="reviewed"
              render={({ field }) => (
                <FormItem className="flex items-start gap-2 space-y-0 border-t pt-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div>
                    <FormLabel className="!mt-0">
                      Granskad – redo att publicera
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Annonsen flyttas till &quot;Redo att publicera&quot; när
                      den sparas.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={updateListing.isPending}>
                {updateListing.isPending
                  ? 'Sparar...'
                  : 'Spara/uppdatera annons'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
