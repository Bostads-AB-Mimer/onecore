import KoaRouter from '@koa/router'
import {
  generateRouteMetadata,
  makeSuccessResponseBody,
} from '@onecore/utilities'

import config from '../../common/config'
import { CREATE_CONTACT_STATUS } from '../../adapters/contacts-adapter'
import {
  registerApplicant,
  type RegisterApplicantResult,
} from '../../processes/contacts/register-applicant'
import { isContactsProvisioningConfigured } from './contacts-keycloak-provisioning'
import {
  isOldEnoughToRegister,
  normalizeRegistrationNationalId,
  RegisterContactRequestBodySchema,
} from './contacts-registration-schema'

const isRegistrationConfigured = () =>
  Boolean(
    config.auth.keycloak.url &&
    config.auth.keycloak.contacts.realm &&
    isContactsProvisioningConfigured()
  )

type Failure = Extract<RegisterApplicantResult, { outcome: 'failed' }>['error']

const statusForFailure = (error: Failure): number =>
  error === 'person-lookup-failed' ? 503 : CREATE_CONTACT_STATUS[error]

/**
 * Registration of a new applicant from Mina sidor, called by webapi.
 */
export const registerContactsRegistrationRoute = (router: KoaRouter) => {
  /**
   * @swagger
   * /auth/contacts/register:
   *   post:
   *     summary: Register a new applicant
   *     description: |
   *       Server-to-server for webapi. Creates the contact, saves the application profile, adds the queues,
   *       creates the person's login in the mimer-contacts realm and e-mails them a link to choose a password.
   *
   *       Never creates a second contact for a personnummer. When one already exists the answer is 200 with
   *       outcome `existing` (an active person contact: log in) or `inactive` (only inactive contacts, or a row
   *       that is no person contact: contact kundtjänst), and nothing is changed, in Keycloak either.
   *
   *       NOT TRANSACTIONAL. The contact is created in Xpand and cannot be removed. Once it exists the answer is
   *       always 201, and a later step that failed is listed under `warnings`. Do not retry a request that may
   *       have created the contact; registering again answers `existing`.
   *
   *       Registration opens in the calendar year the person turns 16.
   *     tags:
   *       - Auth
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [nationalId, firstName, lastName, address, emailAddress]
   *             properties:
   *               nationalId:
   *                 type: string
   *                 description: Personnummer or samordningsnummer, 10 or 12 digits, with or without separator
   *               firstName:
   *                 type: string
   *               lastName:
   *                 type: string
   *               address:
   *                 type: object
   *                 required: [street, zipCode, city]
   *                 properties:
   *                   street: { type: string }
   *                   careOf: { type: string }
   *                   zipCode: { type: string }
   *                   city: { type: string }
   *                   country: { type: string, description: Sweden when omitted }
   *               emailAddress:
   *                 type: string
   *                 format: email
   *                 description: Where the set-password link is sent
   *               phoneNumbers:
   *                 type: array
   *                 maxItems: 3
   *                 items:
   *                   type: object
   *                   required: [phoneNumber]
   *                   properties:
   *                     phoneNumber: { type: string }
   *                     type: { type: string, enum: [mobile, home, work], default: mobile }
   *                     isPrimary: { type: boolean, default: false }
   *               waitingLists:
   *                 type: array
   *                 items: { type: integer, enum: [1, 2, 3] }
   *                 description: 1 parking space, 2 housing (Bostad, Nyproduktion, Kooperativ and Ungdom), 3 storage
   *               applicationProfile:
   *                 type: object
   *                 description: Household and housing reference, as for the client application profile
   *     responses:
   *       '201':
   *         description: |
   *           Registered. `content` is `{outcome: "created", contactCode, warnings}`, where warnings are any of
   *           `application-profile-failed`, `waiting-lists-failed` and `login-setup-failed` (no login or no e-mail;
   *           kundtjänst or the nightly sync creates it).
   *       '200':
   *         description: |
   *           Nothing was created. `content` is `{outcome: "existing"}` or `{outcome: "inactive"}`.
   *       '400':
   *         description: Invalid body (invalid-request)
   *       '422':
   *         description: Not a valid personnummer (invalid-national-id), too young to register (too-young), or Xpand refused the contact (xpand-rejected)
   *       '502':
   *         description: The contacts service or Xpand failed; nothing was created
   *       '503':
   *         description: Registration is not configured on this environment (registration-not-configured), existing contacts could not be checked (person-lookup-failed), or Xpand is unavailable
   */
  router.post('(.*)/auth/contacts/register', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    // Checked before anything is created, so a misconfigured environment cannot leave
    // contacts behind without a login.
    if (!isRegistrationConfigured()) {
      ctx.status = 503
      ctx.body = { error: 'registration-not-configured', ...metadata }
      return
    }

    const parsed = RegisterContactRequestBodySchema.safeParse(ctx.request.body)
    if (!parsed.success) {
      ctx.status = 400
      ctx.body = {
        error: 'invalid-request',
        // Field paths only; the messages can echo what was typed.
        fields: [...new Set(parsed.error.issues.map((i) => i.path.join('.')))],
        ...metadata,
      }
      return
    }

    const nationalId = normalizeRegistrationNationalId(parsed.data.nationalId)
    if (!nationalId) {
      ctx.status = 422
      ctx.body = { error: 'invalid-national-id', ...metadata }
      return
    }
    if (!isOldEnoughToRegister(nationalId, new Date())) {
      ctx.status = 422
      ctx.body = { error: 'too-young', ...metadata }
      return
    }

    const result = await registerApplicant({ ...parsed.data, nationalId })

    switch (result.outcome) {
      case 'created':
        ctx.status = 201
        ctx.body = makeSuccessResponseBody(
          {
            outcome: result.outcome,
            contactCode: result.contactCode,
            warnings: result.warnings,
          },
          metadata
        )
        return
      case 'existing':
      case 'inactive':
        ctx.status = 200
        ctx.body = makeSuccessResponseBody(
          { outcome: result.outcome },
          metadata
        )
        return
      case 'failed':
        // Never the contacts service's `detail`: for a duplicate it names an existing contact.
        ctx.status = statusForFailure(result.error)
        ctx.body = { error: result.error, ...metadata }
        return
    }
  })
}
