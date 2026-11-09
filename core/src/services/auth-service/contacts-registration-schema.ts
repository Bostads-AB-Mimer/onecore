import z from 'zod'
import { WaitingListType } from '@onecore/types'
import {
  CreateContactAddressSchema,
  CreateContactPhoneNumberSchema,
  CreateContactRequestBodySchema,
} from '@onecore/contacts/schema'

import { UpdateApplicationProfileRequestParams } from '../lease-service/schemas/client/application-profile'

/**
 * A new applicant registering on Mina sidor.
 *
 * Narrower than POST /v1/contacts on purpose: one address, one e-mail (required, because the
 * set-password link goes there) and at most three phone numbers, as the registration form
 * collects them. Name and address rules are reused from the contacts service so the two
 * contracts cannot drift apart.
 */
export const RegisterContactRequestBodySchema =
  CreateContactRequestBodySchema.pick({
    nationalId: true,
    firstName: true,
    lastName: true,
  }).extend({
    address: CreateContactAddressSchema,
    emailAddress: z.string().email(),
    phoneNumbers: z.array(CreateContactPhoneNumberSchema).max(3).default([]),
    /** Queue time starts at enrolment, so a queue left out here costs real seniority. */
    waitingLists: z.array(z.nativeEnum(WaitingListType)).default([]),
    applicationProfile: UpdateApplicationProfileRequestParams.optional(),
  })

export type RegisterContactRequestBody = z.infer<
  typeof RegisterContactRequestBodySchema
>

export const RegistrationWarningSchema = z.enum([
  'application-profile-failed',
  'waiting-lists-failed',
  /** No Keycloak user or no set-password e-mail; kundtjänst or the nightly run sorts it out. */
  'login-setup-failed',
  /**
   * A login with this personnummer already existed, so no set-password e-mail was sent. The
   * person logs in, or uses "Glömt lösenord" if they never chose a password.
   */
  'login-exists',
  /**
   * A login with this personnummer already existed but belongs to another contact, which it
   * keeps, so no e-mail was sent. Logging in would show that contact, not the new one, so the
   * person needs kundtjänst.
   */
  'login-bound-to-other-contact',
])

export type RegistrationWarning = z.infer<typeof RegistrationWarningSchema>
