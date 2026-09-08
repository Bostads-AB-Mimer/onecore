import z from 'zod'
import { WaitingListType } from '@onecore/types'
import { CreateContactRequestBodySchema } from '@onecore/contacts/schema'

import { UpdateApplicationProfileRequestParams } from '../../../services/lease-service/schemas/client/application-profile'

export const PhoneNumberTypeSchema = z.enum([
  'work',
  'home',
  'mobile',
  'direct-line',
  'fax',
  'pager',
  'unspecified',
])

export const PhoneNumberSchema = z.object({
  phoneNumber: z.string(),
  type: PhoneNumberTypeSchema,
  comment: z.string().optional(),
  isPrimary: z.boolean(),
})

export const EmailAddressSchema = z.object({
  emailAddress: z.string(),
  type: z.string(),
  isPrimary: z.boolean(),
})

export const ContactIdentitySchema = z.object({
  nationalId: z.string().nullable(),
  birthDate: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string(),
})

export const ContactCommunicationSchema = z.object({
  phoneNumbers: z.array(PhoneNumberSchema),
  emailAddresses: z.array(EmailAddressSchema),
  specialAttention: z.boolean(),
})

export const ContactAddressSchema = z.object({
  careOf: z.string().optional(),
  street: z.string().nullable(),
  zipCode: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
})

export const RelatedContactRoleSchema = z.enum([
  'trustee', // god man
  'administrator', // förvaltare
  'trusteeFor', // subject is god man for this contact
  'administratorFor', // subject is förvaltare for this contact
  'otherInvoiceRecipient', // annan fakturamottagare
  'otherInvoiceRecipientFor',
])

export const RelatedContactSchema = z.object({
  contactCode: z.string(),
  role: RelatedContactRoleSchema,
  fullName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
})

export const ContactBaseSchema = z.object({
  contactCode: z.string(),
  communication: ContactCommunicationSchema,
  addresses: z.array(ContactAddressSchema),
  relatedContacts: z.optional(z.array(RelatedContactSchema)),
})

export const ContactPersonalDetailsSchema = z.object({
  nationalRegistrationNumber: z.string().nullable(),
  birthDate: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string(),
})

export const ContactOrganisationDetailsSchema = z.object({
  organisationNumber: z.string(),
  name: z.string(),
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

export const GetContactsListResponseBodySchema =
  ONECoreHateOASResponseBodySchema.extend({
    content: z.array(ContactSchema),
  })

/* -------------------------------------------------------------------------
 * Creating contacts
 * ---------------------------------------------------------------------- */

/**
 * Outcome of one step that runs after the contact itself has been created.
 *
 * These steps are not transactional with the create. Once the contact exists it
 * cannot be removed, so a later failure is reported rather than rolled back.
 */
export const CreateContactStepStatusSchema = z.enum([
  'created',
  'skipped',
  'failed',
])

/** Outcome of one requested waiting-list enrolment. */
export const CreateContactWaitingListResultSchema = z.object({
  waitingListType: z.nativeEnum(WaitingListType),
  status: CreateContactStepStatusSchema,
  error: z.string().optional(),
})

/**
 * Request to create a contact together with the application profile a housing
 * applicant needs.
 *
 * The contact fields are reused verbatim from the contacts service rather than
 * redeclared, so the two contracts cannot drift apart.
 */
export const CreateContactRequestBodySchema_APIv1 =
  CreateContactRequestBodySchema.extend({
    /**
     * Household and housing reference. Stored in ONECore's own application
     * profile, not in Xpand. Omit for a customer who does not need one.
     */
    applicationProfile: UpdateApplicationProfileRequestParams.optional(),
    /**
     * Waiting lists to enrol the new customer in, mirroring the queue choice
     * in the public registration flow. Queue time starts at enrolment, so
     * omitting a queue the customer wanted costs them real seniority.
     */
    waitingLists: z.array(z.nativeEnum(WaitingListType)).default([]),
  })

export const CreateContactResponseBodySchema_APIv1 =
  ONECoreHateOASResponseBodySchema.extend({
    content: z.object({
      contactCode: z.string(),
      contact: ContactSchema.nullable(),
      applicationProfile: z.object({
        status: CreateContactStepStatusSchema,
        error: z.string().optional(),
      }),
      waitingLists: z.array(CreateContactWaitingListResultSchema),
    }),
    /**
     * Present when the contact was created but a later step did not complete.
     * Written for a caseworker to read, in Swedish.
     */
    warnings: z.array(z.string()).optional(),
  })

export const CreateContactErrorResponseBodySchema_APIv1 = z.object({
  error: z.string(),
  detail: z.string().optional(),
})
