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

import type { VacantApartment } from './useVacantApartments'

interface ListingFormValues {
  publishedTo: Date | undefined
  publishUntilFurtherNotice: boolean
  reviewed: boolean
}

interface EditListingDialogProps {
  apartment: VacantApartment | null
  onClose: () => void
  onSave: (apartment: VacantApartment, values: ListingFormValues) => void
}

const formatAddress = (address: VacantApartment['address']) =>
  address?.street ?? '–'

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('sv-SE') : '–'

/**
 * Matches the design's date-input look (border, calendar icon) for a date
 * that isn't actually editable here — not a plain Field, so it doesn't read
 * as just another fact in the grid above.
 */
function DisabledDateField({
  label,
  display,
}: {
  label: string
  display: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{label}</label>
      <Button
        type="button"
        variant="outline"
        disabled
        className="w-full justify-start text-left font-normal"
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {display}
      </Button>
    </div>
  )
}

const defaultValues = (apartment: VacantApartment): ListingFormValues => ({
  publishedTo: apartment.listing?.publishedTo
    ? new Date(apartment.listing.publishedTo)
    : undefined,
  publishUntilFurtherNotice:
    !!apartment.listing?.publishedFrom && !apartment.listing?.publishedTo,
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
  onSave,
}: EditListingDialogProps) {
  const form = useForm<ListingFormValues>({
    defaultValues: apartment
      ? defaultValues(apartment)
      : {
          publishedTo: undefined,
          publishUntilFurtherNotice: false,
          reviewed: false,
        },
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
    onSave(apartment, values)
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

        <Tabs defaultValue="grundlaggande">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="grundlaggande">Grundläggande</TabsTrigger>
            <TabsTrigger value="beskrivning">
              Detaljerad beskrivning
            </TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="planritning">Planritning</TabsTrigger>
          </TabsList>

          <TabsContent value="grundlaggande" className="min-h-[520px]">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
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
                    {/* No backing field yet — confirm with team whether this
                        belongs on Listing (new migration) or comes from
                        property/Tenfast. */}
                    <Field label="Byggnadsår" />
                    <Field
                      label="Objektsnummer"
                      value={apartment.rentalObjectCode}
                    />
                    {/* No backing field yet, see Byggnadsår above. */}
                    <Field label="Besiktning genomförd" />
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* publishedFrom is set once the listing is actually
                      published, not by this form — shown disabled so it's
                      visible without implying it can be edited here. */}
                  <DisabledDateField
                    label="Publicera från"
                    display={
                      apartment.listing?.publishedFrom
                        ? format(
                            new Date(apartment.listing.publishedFrom),
                            'd MMMM yyyy',
                            { locale: sv }
                          )
                        : 'Välj startdatum'
                    }
                  />

                  {apartment.listing?.publishedFrom ? (
                    <DisabledDateField
                      label="Publicera till"
                      display={
                        apartment.listing.publishedTo
                          ? format(
                              new Date(apartment.listing.publishedTo),
                              'd MMMM yyyy',
                              { locale: sv }
                            )
                          : 'Tillsvidare'
                      }
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
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
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
                </div>

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
                  {/* vacantFrom is computed from Tenfast lease data (AVTAL-343),
                      so it's shown disabled here rather than as an editable
                      date picker like the design mockup has it. */}
                  <DisabledDateField
                    label="Tillgänglig från"
                    display={formatDate(apartment.vacantFrom)}
                  />
                  {/* No backing field yet, see Byggnadsår above. */}
                  <DisabledDateField
                    label="Eventuellt tillgänglig från"
                    display={formatDate(undefined)}
                  />
                </div>

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
                          Annonsen flyttas till &quot;Redo att publicera&quot;
                          när den sparas.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="submit">Spara/uppdatera annons</Button>
                </div>
              </form>
            </Form>
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
      </DialogContent>
    </Dialog>
  )
}
