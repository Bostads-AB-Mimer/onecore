import { EmailAddress } from '@src/domain/contact'
import { DbEmailAddress } from '../db-model'

export const transformEmailAddresses = (
  emails: DbEmailAddress[]
): EmailAddress[] =>
  emails.map(transformEmailAddress).filter((em) => em !== undefined)

export const transformEmailAddress = (email: DbEmailAddress): EmailAddress => ({
  emailAddress: email.emailAddress,
  type: 'unspecified',
  isPrimary: email.isPrimaryEmail,
})
