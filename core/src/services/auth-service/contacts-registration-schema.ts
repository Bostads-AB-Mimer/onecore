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
])

export type RegistrationWarning = z.infer<typeof RegistrationWarningSchema>

/** Registration opens in the calendar year a person turns this age. */
const REGISTRATION_AGE = 16

/** Swedish time, not the container's UTC, so the year turns at midnight in Sweden. */
const stockholmYear = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
})

/**
 * Whether a person may register, by birth year rather than exact age: from the calendar year
 * they turn 16, as Mina sidor has always promised. Creating a contact by a caseworker keeps
 * the exact-age rule.
 *
 * @param nationalId twelve digits, from toContactsUsername
 */
export function isOldEnoughToRegister(nationalId: string, now: Date): boolean {
  const birthYear = Number(nationalId.slice(0, 4))
  return Number(stockholmYear.format(now)) - birthYear >= REGISTRATION_AGE
}
