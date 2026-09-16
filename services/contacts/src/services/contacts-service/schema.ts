import z from 'zod'

export const RelatedContactRoleSchema = z.enum([
  'trustee', // god man
  'administrator', // förvaltare
  'trusteeFor', // the subject is god man for this contact (its huvudman)
  'administratorFor', // the subject is förvaltare for this contact (its huvudman)
  'otherInvoiceRecipient', // annan fakturamottagare — receives the subject's invoices
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
 * The request is discriminated on `type`. An `individual` is a private person:
 * `nationalId` is validated as a personnummer or samordningsnummer and a
 * minimum age is enforced. An `organisation` is any legal person — company,
 * municipality, region, state body, internal or other — identified by an
 * organisation number and a single name, and placed in one of Xpand's
 * organisation categories. The two are kept as separate arms rather than a
 * widened field set because their validation rules genuinely differ.
 *
 * Xpand's create operation only produces natural persons, so an organisation
 * is created as one and then converted to its category (name in a single
 * field, no birth date, no name split, contact code re-prefixed). That second
 * step is idempotent but not transactional with the first; its outcome is
 * reported under `conversion` in the response rather than as an error status,
 * because the contact exists either way.
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

/**
 * Xpand's contact categories for legal persons: company (F), internal (I),
 * municipal (K), regional (L), other (Ö) and state (S). The letter is also
 * the prefix of the contact code, which is how the business — and this
 * service's read side — tells contact types apart.
 */
export const ContactCategorySchema = z.enum(['F', 'I', 'K', 'L', 'Ö', 'S'])

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

/** Contact details shared by every kind of contact. */
const CreateContactDetailsSchema = z.object({
  addresses: z.array(CreateContactAddressSchema).min(1),
  /**
   * At least one is required for every kind: the web account provisioned
   * alongside the contact needs an address to reach the customer on.
   */
  emailAddresses: z.array(CreateContactEmailAddressSchema).min(1),
  phoneNumbers: z.array(CreateContactPhoneNumberSchema).default([]),
})

export const CreateContactIndividualRequestBodySchema =
  CreateContactDetailsSchema.extend({
    type: z.literal('individual'),
    /**
     * Personnummer. Accepted in any common notation; normalised and checksum
     * validated by the service, which is the single source of truth for what
     * counts as valid.
     */
    nationalId: z.string().min(10),
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
  })

export const CreateContactOrganisationRequestBodySchema =
  CreateContactDetailsSchema.extend({
    type: z.literal('organisation'),
    /**
     * Organisationsnummer. Accepted in any common notation; normalised and
     * checksum validated by the service. A personal identity number is
     * rejected here — a person must be created as an `individual`.
     */
    organisationNumber: z.string().min(10),
    /** The registered name. Xpand stores it in a single 100-character field. */
    name: z.string().min(1).max(100),
    category: ContactCategorySchema.default('F'),
  })

export const CreateContactRequestBodySchema = z.discriminatedUnion('type', [
  CreateContactIndividualRequestBodySchema,
  CreateContactOrganisationRequestBodySchema,
])

/**
 * Outcome of the category conversion that follows the creation of an
 * organisation.
 *
 * `done`: the contact carries its organisation category and prefixed code.
 * `not-applicable`: the contact is an individual; nothing to convert.
 * `failed`: the contact exists as a natural person under the code returned
 * in `contactCode`. The conversion is idempotent and can be completed later;
 * `error` names the failure for the logs.
 */
export const CreateContactConversionSchema = z.object({
  status: z.enum(['done', 'not-applicable', 'failed']),
  error: z.string().optional(),
})

export const CreateContactResponseBodySchema =
  ONECoreHateOASResponseBodySchema.extend({
    content: z.object({
      /**
       * The contact's code. For an organisation this is the re-prefixed code
       * (e.g. `F069077`) once conversion is done, and the original person code
       * (`P069077`) when it failed — see `conversion`.
       */
      contactCode: z.string(),
      /**
       * The created contact, read back immediately after creation. Null when
       * that read did not resolve — the contact still exists, and
       * `contactCode` is always authoritative.
       */
      contact: ContactSchema.nullable(),
      conversion: CreateContactConversionSchema,
    }),
  })

export const CreateContactErrorCodeSchema = z.enum([
  'duplicate-contact',
  'invalid-national-id',
  'invalid-organisation-number',
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
