import z from 'zod'
import Personnummer from 'personnummer'
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
])

export type RegistrationWarning = z.infer<typeof RegistrationWarningSchema>

const PERSONNUMMER_OPTIONS = {
  allowCoordinationNumber: true,
  allowInterimNumber: false,
}

/**
 * The personnummer (or samordningsnummer) as twelve digits, the form used for Keycloak
 * usernames, or null when it is not a valid one.
 */
export function normalizeRegistrationNationalId(input: string): string | null {
  if (!Personnummer.valid(input, PERSONNUMMER_OPTIONS)) return null
  return Personnummer.parse(input, PERSONNUMMER_OPTIONS).format(true)
}

/** Registration opens in the calendar year a person turns this age. */
const REGISTRATION_AGE = 16

/**
 * Whether a person may register, by birth year rather than exact age: from the calendar year
 * they turn 16, as Mina sidor has always promised. Creating a contact by a caseworker keeps
 * the exact-age rule.
 *
 * @param nationalId twelve digits, from normalizeRegistrationNationalId
 */
export function isOldEnoughToRegister(
  nationalId: string,
  today: Date
): boolean {
  const birthYear = Number(nationalId.slice(0, 4))
  return today.getFullYear() - birthYear >= REGISTRATION_AGE
}
