import { useState } from 'react'
import { type DefaultValues, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { PlusCircle } from 'lucide-react'

import { useToast } from '@/shared/hooks/useToast'
import { paths } from '@/shared/routes'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
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
import { Input } from '@/shared/ui/Input'
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
  CONTACT_CATEGORIES,
  contactCategoryLabels,
  createContactErrorMessage,
  type CreateContactFormInput,
  createContactFormSchema,
  type CreateContactFormValues,
  duplicateContactCode,
  HOUSING_TYPES,
  housingTypeLabels,
  isOrganisationCategory,
  requiresHousingDescription,
  requiresLandlord,
  WAITING_LISTS,
} from '../lib/createContact'

/**
 * Marks a required field, the same way the feedback form does. Every field
 * without this mark or a "(valfritt)" suffix has a default, so the two
 * together tell the caseworker what must be filled in before submitting.
 */
const Required = () => <span className="text-destructive">*</span>

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
    // The cast is needed because the defaults span every union arm: the
    // organisation fields and the profile defaults must exist before their
    // category or checkbox is chosen, but no single arm of the schema has them
    // all.
    defaultValues: {
      category: 'individual',
      waitingLists: [],
      nationalId: '',
      firstName: '',
      lastName: '',
      organisationNumber: '',
      name: '',
      street: '',
      careOf: '',
      zipCode: '',
      city: '',
      emailAddress: '',
      phoneNumber: '',
      applicationProfile: {
        enabled: false,
        numAdults: 1,
        numChildren: 0,
        housingReference: { phone: '', email: '' },
      },
    } as DefaultValues<CreateContactFormInput>,
  })

  const category = form.watch('category')
  const isOrganisation = isOrganisationCategory(category)
  const withProfile = form.watch('applicationProfile.enabled')
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

  // The error wording follows the submission that failed, not the current
  // dropdown value — otherwise switching category after a duplicate would
  // relabel the same error as a collision on a number that was never sent.
  const failedParty = isOrganisationCategory(createContact.variables?.category)
    ? 'organisation'
    : 'individual'

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
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ av kund</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONTACT_CATEGORIES.map((contactCategory) => (
                        <SelectItem
                          key={contactCategory}
                          value={contactCategory}
                        >
                          {contactCategoryLabels[contactCategory]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isOrganisation ? (
              <>
                <FormField
                  control={form.control}
                  name="organisationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Organisationsnummer <Required />
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="NNNNNN-NNNN" {...field} />
                      </FormControl>
                      <FormDescription>
                        Används som användarnamn på Mina sidor.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Namn <Required />
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="nationalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Personnummer <Required />
                      </FormLabel>
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
                        <FormLabel>
                          Förnamn <Required />
                        </FormLabel>
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
                        <FormLabel>
                          Efternamn <Required />
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Gatuadress <Required />
                  </FormLabel>
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
                    <FormLabel>
                      Postnummer <Required />
                    </FormLabel>
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
                    <FormLabel>
                      Ort <Required />
                    </FormLabel>
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
                  <FormLabel>
                    E-postadress <Required />
                  </FormLabel>
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
                  <FormLabel>
                    Telefonnummer <Required />
                  </FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Household data and queues are for housing applicants; an
                organisation gets neither, so the sections are hidden rather
                than disabled. */}
            {!isOrganisation && (
              <>
                <Separator />

                <FormField
                  control={form.control}
                  name="applicationProfile.enabled"
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
                          <FormLabel>
                            Boendeform <Required />
                          </FormLabel>
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
                            <FormLabel>
                              Hyresvärd <Required />
                            </FormLabel>
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
                            <FormLabel>
                              Beskriv boendet <Required />
                            </FormLabel>
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
                        Kunden ställs i valda köer direkt — kötiden börjar
                        räknas vid registreringen.
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
              </>
            )}

            {createContact.error && (
              <p className="text-sm text-destructive">
                {createContactErrorMessage(
                  createContact.error.error,
                  createContact.error.detail,
                  failedParty
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
