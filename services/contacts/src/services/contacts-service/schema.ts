import z from 'zod'

export const RelatedContactRoleSchema = z.enum([
  'trustee', // god man
  'administrator', // förvaltare
  'trusteeFor', // the subject is god man for this contact (its huvudman)
  'administratorFor', // the subject is förvaltare for this contact (its huvudman)
  'otherInvoiceRecipient', // annan fakturamottagare — receives invoices for the subject's leases
  'otherInvoiceRecipientFor', // the subject is the annan fakturamottagare for this contact
])

export const RelatedContactSchema = z.object({
  contactCode: z.string(),
  role: RelatedContactRoleSchema,
  fullName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
})

export const PhoneNumberTypeSchema = z.enum([
  'work',
  'home',
  'mobile',
  'direct-line',
  'fax',
  'pager',
  'unspecified',
])

export const EmailTypeSchema = z.enum(['private', 'work', 'unspecified'])

export const PhoneNumberSchema = z.object({
  phoneNumber: z.string(),
  type: PhoneNumberTypeSchema,
  comment: z.string().optional(),
  isPrimary: z.boolean(),
})

export const EmailAddressSchema = z.object({
  emailAddress: z.string(),
  type: EmailTypeSchema,
  isPrimary: z.boolean(),
})

export const ContactPersonalDetailsSchema = z.object({
  nationalId: z.string().nullable(),
  birthDate: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string(),
})

export const ContactOrganisationDetailsSchema = z.object({
  organisationNumber: z.string(),
  name: z.string(),
})

export const ContactCommunicationSchema = z.object({
  phoneNumbers: z.array(PhoneNumberSchema),
  emailAddresses: z.array(EmailAddressSchema),
  specialAttention: z.boolean(),
})

export const ContactAddressSchema = z.object({
  careOf: z.string().nullable().optional(),
  street: z.string().nullable(),
  zipCode: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  full: z.string().nullable(),
})

export const ContactBaseSchema = z.object({
  contactCode: z.string(),
  contactKey: z.string(),
  communication: ContactCommunicationSchema,
  addresses: z.array(ContactAddressSchema),
  relatedContacts: z.array(RelatedContactSchema).optional(),
})

export const ContactIndividualSchema = ContactBaseSchema.extend({
  type: z.literal('individual'),
  personal: ContactPersonalDetailsSchema,
})

export const ContactOrganisationSchema = ContactBaseSchema.extend({
  type: z.literal('organisation'),
  organisation: ContactOrganisationDetailsSchema,
})

export const ContactSchema = z.discriminatedUnion('type', [
  ContactIndividualSchema,
  ContactOrganisationSchema,
])

export const ONECoreHateOASResponseBodySchema = z.object({
  _links: z.any(),
})

export const GetContactResponseBodySchema =
  ONECoreHateOASResponseBodySchema.extend({
    content: ContactSchema,
  })

export const GetContactsResponseBodySchema =
  ONECoreHateOASResponseBodySchema.extend({
    content: z.object({
      contacts: z.array(ContactSchema),
    }),
  })

export const GetRelatedContactsResponseBodySchema =
  ONECoreHateOASResponseBodySchema.extend({
    content: z.object({
      relations: z.array(RelatedContactSchema),
    }),
  })

export const SyncContactsResponseBodySchema =
  ONECoreHateOASResponseBodySchema.extend({
    content: z.object({
      contacts: z.array(
        z.object({
          contact: ContactSchema,
          timestamp: z.string().datetime(),
        })
      ),
    }),
  })

export const ErrorResponseBodySchema = z.object({
  error: z.string(),
})

/* -------------------------------------------------------------------------
 * Creating contacts
 *
 * This contract creates *private individuals only*. `nationalId` is validated
 * as a personnummer or samordningsnummer and a minimum age is enforced, so an
 * organisationsnummer is rejected as `invalid-national-id` — the person-ness is
 * a real constraint here, not merely an omission.
 *
 * Creating a company will need its own seam: Xpand's create operation only
 * produces natural persons, so a commercial customer has to be converted to
 * contact category F afterwards, with the name in a single field and no birth
 * date, age check or name split. Expect a discriminator on this schema rather
 * than a widening of the fields below.
 *
 * Every contact created here does get the applicant role, because a contact
 * without it cannot sign in to Mina sidor at all. Whether housing queues are
 * joined and whether an application profile is written lives in other
 * services, so that distinction belongs to the orchestrating core route.
 *
 * Household size (adults, children) is likewise absent: it is ONECore data,
 * stored in the leasing service's application profile. Xpand has a legacy
 * field for it that we deliberately leave unset.
 * ---------------------------------------------------------------------- */

export const CreateContactAddressSchema = z.object({
  careOf: z.string().optional(),
  street: z.string().min(1),
  zipCode: z.string().min(1),
  city: z.string().min(1),
  /** Defaults to Sweden downstream when omitted. */
  country: z.string().optional(),
})

export const CreateContactEmailAddressSchema = z.object({
  emailAddress: z.string().email(),
  type: EmailTypeSchema.default('private'),
  isPrimary: z.boolean().default(true),
})

export const CreateContactPhoneNumberSchema = z.object({
  phoneNumber: z.string().min(1),
  /** Xpand only models these three on a contact created this way. */
  type: z.enum(['mobile', 'home', 'work']).default('mobile'),
  isPrimary: z.boolean().default(false),
})

export const CreateContactRequestBodySchema = z.object({
  /**
   * Personnummer. Accepted in any common notation; normalised and checksum
   * validated by the service, which is the single source of truth for what
   * counts as valid.
   */
  nationalId: z.string().min(10),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  addresses: z.array(CreateContactAddressSchema).min(1),
  /**
   * At least one is required for every kind: the web account provisioned
   * alongside the contact needs an address to reach the customer on.
   */
  emailAddresses: z.array(CreateContactEmailAddressSchema).min(1),
  phoneNumbers: z.array(CreateContactPhoneNumberSchema).default([]),
})

export const CreateContactResponseBodySchema =
  ONECoreHateOASResponseBodySchema.extend({
    content: z.object({
      contactCode: z.string(),
      /**
       * The created contact, read back immediately after creation. Null when
       * that read did not resolve — the contact still exists, and
       * `contactCode` is always authoritative.
       */
      contact: ContactSchema.nullable(),
    }),
  })

export const CreateContactErrorCodeSchema = z.enum([
  'duplicate-contact',
  'invalid-national-id',
  'write-backend-not-configured',
  'xpand-rejected',
  'xpand-fault',
  'xpand-unavailable',
  'xpand-auth-failed',
  'xpand-malformed-response',
])

export const CreateContactErrorResponseBodySchema = z.object({
  error: CreateContactErrorCodeSchema,
  /**
   * Human-readable context. For `duplicate-contact` this is the existing
   * contact code, so the caller can link to it; for `xpand-rejected` it is
   * Xpand's own Swedish validation message.
   */
  detail: z.string().optional(),
})
