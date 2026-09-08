import { logger } from '@onecore/utilities'

import { ContactWriter } from '@src/adapters/contact-writer'
import { XpandSoapConfig } from '@src/common/config'
import { makeSoapClient } from './client'
import {
  CREATE_APPLICANT_ACTION,
  buildCreateApplicantEnvelope,
  parseCreateApplicantResponse,
} from './create-applicant'

/**
 * A `ContactWriter` backed by Xpand's Incit SOAP service.
 *
 * One upstream call creates the contact, attaches the applicant role, and
 * provisions the web account with its password — none of which we could
 * reproduce by writing to the database directly, since the customer number
 * series, the role rows and the password hash are all internal to Xpand.
 */
export const xpandSoapContactWriter = (
  config: XpandSoapConfig
): ContactWriter => {
  const client = makeSoapClient(config)

  return {
    createContact: async (input) => {
      try {
        const response = await client.call(
          CREATE_APPLICANT_ACTION,
          buildCreateApplicantEnvelope(config, input)
        )

        if (!response.ok) return response

        // A rejection logs its own Xpand diagnostics inside the parser, where
        // the raw fields are still in hand.
        return parseCreateApplicantResponse(response.data)
      } catch (err) {
        // The client handles everything around the call itself; this covers
        // building the envelope and reading the response. Reported as malformed
        // rather than as a plain failure: if the throw happened after the call
        // returned, a contact may exist whose code we never read, and the
        // caller must recover it instead of retrying into the duplicate check.
        logger.error({ err }, 'xpandSoapContactWriter.createContact')
        return { ok: false, err: 'xpand-malformed-response' }
      }
    },
  }
}
