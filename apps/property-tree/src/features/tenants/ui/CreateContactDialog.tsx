import { useState } from 'react'
import { useForm, type DefaultValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'

import { useToast } from '@/shared/hooks/useToast'
import { paths } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/Dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/Form'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'
import { Separator } from '@/shared/ui/Separator'

import { useCreateContact } from '../hooks/useCreateContact'
import {
  createContactErrorMessage,
  createContactFormSchema,
  duplicateContactCode,
  customerTypeLabels,
  HOUSING_TYPES,
  housingTypeLabels,
  requiresHousingDescription,
  requiresLandlord,
  WAITING_LISTS,
  type CreateContactFormInput,
  type CreateContactFormValues,
} from '../lib/createContact'

export const CreateContactDialog = () => {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const navigate = useNavigate()
  const createContact = useCreateContact()

  // Input and output types differ (defaults and number coercion), so the form
  // is typed with both: fields hold the input shape, submit gets the parsed one.
  const form = useForm<
    CreateContactFormInput,
    unknown,
    CreateContactFormValues
  >({
    resolver: zodResolver(createContactFormSchema),
    // The cast is needed because the defaults span both union arms: the
    // profile defaults must exist before the checkbox is ticked, but the
    // unticked arm of the schema has no applicationProfile key.
    defaultValues: {
      withApplicationProfile: false,
      waitingLists: [],
      nationalId: '',
      firstName: '',
      lastName: '',
      street: '',
      careOf: '',
      zipCode: '',
      city: '',
      emailAddress: '',
      phoneNumber: '',
      applicationProfile: {
        numAdults: 1,
        numChildren: 0,
        housingReference: { phone: '', email: '' },
      },
    } as DefaultValues<CreateContactFormInput>,
  })

  const withProfile = form.watch('withApplicationProfile')
  const housingType = form.watch('applicationProfile.housingType')

  /**
   * On a duplicate the blocking customer already exists, so the error can link
   * straight to them — otherwise the caseworker has to go and search for a
   * customer they cannot see the name of.
   */
  const duplicateCode = duplicateContactCode(
    createContact.error?.error,
    createContact.error?.detail
  )

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      form.reset()
      createContact.reset()
    }
  }

  const onSubmit = (values: CreateContactFormValues) => {
    createContact.mutate(values, {
      onSuccess: (result) => {
        handleOpenChange(false)
        // No welcome e-mail exists, so the caseworker is the one who tells the
        // customer how to get in.
        toast({
          title: 'Kund skapad',
          description: `Kundnummer ${result.content.contactCode}. Kunden loggar in via "Glömt lösenord" på Mina sidor.`,
        })
        // The customer exists even when a later step failed. The warnings say
        // which step needs completing — show them verbatim.
        for (const warning of result.warnings ?? []) {
          toast({
            title: 'Åtgärd kvarstår',
            description: warning,
            variant: 'destructive',
          })
        }
        navigate(paths.tenant(result.content.contactCode))
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="h-4 w-4 mr-2" />
          Ny kund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ny kund</DialogTitle>
          <DialogDescription>
            Kunden registreras i Xpand och kan inte tas bort härifrån.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-2"
          >
            {/* Not a form field yet — only 'person' can be created until the
                write path supports converting a contact to the F series.
                Shown so the company path is visible rather than hidden. */}
            <div className="grid gap-2">
              <Label>Typ av kund</Label>
              <Select value="person">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">
                    {customerTypeLabels.person}
                  </SelectItem>
                  <SelectItem value="company" disabled>
                    {customerTypeLabels.company} – kommer snart
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <FormField
              control={form.control}
              name="nationalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personnummer</FormLabel>
                  <FormControl>
                    <Input placeholder="ÅÅÅÅMMDD-XXXX" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Förnamn</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Efternamn</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gatuadress</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="careOf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>C/O (valfritt)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postnummer</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ort</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="emailAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-postadress</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefonnummer</FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="withApplicationProfile"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Registrera hushållsuppgifter</FormLabel>
                    <FormDescription>
                      För bostadssökande. Kan även kompletteras senare från
                      kundkortet.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {withProfile && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="applicationProfile.numAdults"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Antal vuxna</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="applicationProfile.numChildren"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Antal barn</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="applicationProfile.housingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Boendeform</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj boendeform" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {HOUSING_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {housingTypeLabels[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {requiresLandlord(housingType) && (
                  <FormField
                    control={form.control}
                    name="applicationProfile.landlord"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hyresvärd</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {requiresHousingDescription(housingType) && (
                  <FormField
                    control={form.control}
                    name="applicationProfile.housingTypeDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beskriv boendet</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="applicationProfile.housingReference.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referens, telefon (valfritt)</FormLabel>
                        <FormControl>
                          <Input type="tel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="applicationProfile.housingReference.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referens, e-post (valfritt)</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <Separator />

            <FormField
              control={form.control}
              name="waitingLists"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Köer</FormLabel>
                  <FormDescription>
                    Kunden ställs i valda köer direkt — kötiden börjar räknas
                    vid registreringen.
                  </FormDescription>
                  <div className="flex gap-6 pt-1">
                    {WAITING_LISTS.map((waitingList) => (
                      <label
                        key={waitingList.type}
                        className="flex items-center gap-2 text-sm font-normal"
                      >
                        <Checkbox
                          checked={field.value?.includes(waitingList.type)}
                          onCheckedChange={(checked) => {
                            const current = field.value ?? []
                            field.onChange(
                              checked
                                ? [...current, waitingList.type]
                                : current.filter(
                                    (type) => type !== waitingList.type
                                  )
                            )
                          }}
                        />
                        {waitingList.label}
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {createContact.error && (
              <p className="text-sm text-destructive">
                {createContactErrorMessage(
                  createContact.error.error,
                  createContact.error.detail
                )}{' '}
                {duplicateCode && (
                  <Link
                    to={paths.tenant(duplicateCode)}
                    className="underline underline-offset-2"
                    onClick={() => handleOpenChange(false)}
                  >
                    Öppna {duplicateCode}
                  </Link>
                )}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createContact.isPending}
              >
                Avbryt
              </Button>
              <Button type="submit" disabled={createContact.isPending}>
                {createContact.isPending ? 'Skapar...' : 'Skapa kund'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
