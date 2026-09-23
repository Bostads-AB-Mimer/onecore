import config from '../../../common/config'
import { ProcessStatus } from '../../../common/types'
import { contactsAdapter } from '../../../adapters/contacts-adapter'
import * as leasingAdapter from '../../../adapters/leasing-adapter'
import * as communicationAdapter from '../../../adapters/communication-adapter'
import * as syncInvoiceRecipient from '../sync-invoice-recipient'
import {
  addRelationStatus,
  addRelation,
  removeRelationStatus,
  removeRelation,
} from '../relation-changes'
import * as factory from '../../../../test/factories'
import { logger } from '@onecore/utilities'
import type { RelatedContact } from '@onecore/contacts/domain'

const NOT_CALLED = new Error('should not be called')

const RECIPIENT = {
  contactCode: 'P111',
  relatedContactCode: 'P222',
  roleType: 'annan_fakturamottagare' as const,
  createdBy: 'Anna Handläggare',
}

const GUARDIAN = {
  contactCode: 'P111',
  relatedContactCode: 'P333',
  roleType: 'god_man' as const,
  createdBy: 'Anna Handläggare',
}

const RELATIONS = {
  relations: [
    {
      contactCode: 'P222',
      role: 'otherInvoiceRecipient' as const,
      fullName: 'Britt Bihandläggare',
      firstName: 'Britt',
      lastName: 'Bihandläggare',
    },
  ],
}

const REMOVAL = {
  contactCode: 'P111',
  relatedContactCode: 'P222',
  roleType: 'annan_fakturamottagare' as const,
  deletedBy: 'Anna Handläggare',
}

const GUARDIAN_REMOVAL = {
  contactCode: 'P111',
  relatedContactCode: 'P333',
  roleType: 'god_man' as const,
  deletedBy: 'Anna Handläggare',
}

const RECIPIENT_RELATION: RelatedContact = {
  contactCode: 'P222',
  role: 'otherInvoiceRecipient',
  fullName: 'Britt Bihandläggare',
  firstName: 'Britt',
  lastName: 'Bihandläggare',
}

/**
 * Every relation write reads the subject's current relations first, so a lost
 * response can be told apart from a rejected one. Default: the subject holds
 * no relations, which is the state most cases here assume.
 */
const mockPresence = (relations: RelatedContact[] = []) =>
  jest.spyOn(contactsAdapter, 'getByContactCodeBatch').mockResolvedValue({
    ok: true,
    data: [
      factory.contactsServiceContact.build({
        contactCode: 'P111',
        relatedContacts: relations,
      }),
    ],
  })

const originalXpandSync = config.emailAddresses.xpandSync

beforeEach(() => {
  ;(config.emailAddresses as Record<string, string>).xpandSync =
    'sync@example.com'
  mockPresence()
})

afterEach(() => {
  ;(config.emailAddresses as Record<string, string>).xpandSync =
    originalXpandSync
  jest.restoreAllMocks()
})

describe('addRelation', () => {
  it('upserts the recipient, writes the relation, then resyncs Tenfast', async () => {
    const economySpy = jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    const addSpy = jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    const syncSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const result = await addRelation(RECIPIENT)

    expect(result.processStatus).toBe(ProcessStatus.successful)
    expect(result.httpStatus).toBe(201)
    if (result.processStatus !== ProcessStatus.successful) {
      throw new Error('expected a successful result')
    }
    expect(result.data).toEqual(RELATIONS)
    expect(economySpy).toHaveBeenCalledWith(contactsAdapter, 'P222')
    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenCalledWith('P111')
  })

  it('writes nothing when the economy-service upsert fails', async () => {
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: false, err: 'sync-failed' })
    const addSpy = jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockRejectedValue(NOT_CALLED)
    const syncSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockRejectedValue(NOT_CALLED)

    const result = await addRelation(RECIPIENT)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'propagation-failed',
      httpStatus: 502,
      response: { detail: 'economy' },
    })
    expect(addSpy).not.toHaveBeenCalled()
    expect(syncSpy).not.toHaveBeenCalled()
  })

  it('answers related-not-found when the recipient does not exist', async () => {
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: false, err: 'contact-not-found' })
    const addSpy = jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockRejectedValue(NOT_CALLED)

    const result = await addRelation(RECIPIENT)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'related-not-found',
      httpStatus: 404,
    })
    expect(addSpy).not.toHaveBeenCalled()
  })

  it('rolls the relation back when the Tenfast resync fails, then confirms the rollback with Tenfast', async () => {
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    const syncSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValueOnce({ ok: false, err: 'sync-failed' })
      .mockResolvedValueOnce({ ok: true, data: { skipped: false } })
    const removeSpy = jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockRejectedValue(NOT_CALLED)

    const result = await addRelation(RECIPIENT)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'propagation-failed',
      httpStatus: 502,
      response: { detail: 'tenfast' },
    })
    expect(removeSpy).toHaveBeenCalledWith({
      contactCode: 'P111',
      relatedContactCode: 'P222',
      roleType: 'annan_fakturamottagare',
      deletedBy: 'Anna Handläggare (rollback)',
    })
    // Once for the failed original sync, once to confirm the rollback.
    expect(syncSpy).toHaveBeenCalledTimes(2)
    expect(mailSpy).not.toHaveBeenCalled()
  })

  it('mails the alarm and answers rollback-failed when the rollback also fails', async () => {
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'sync-failed' })
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null } as any)

    const result = await addRelation(RECIPIENT)

    // Not propagation-failed: that code means the relation was not saved and
    // the UI says retry. Here it IS saved, and a retry can only answer
    // duplicate-relation.
    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'rollback-failed',
      httpStatus: 502,
    })
    expect(mailSpy).toHaveBeenCalledTimes(1)
    expect(mailSpy.mock.calls[0][0].to).toBe('sync@example.com')
    expect(mailSpy.mock.calls[0][0].body).toContain('P111')
    expect(mailSpy.mock.calls[0][0].body).toContain('P222')
    expect(mailSpy.mock.calls[0][0].body).toContain('lades till')
    expect(mailSpy.mock.calls[0][0].body).toContain('Anna Handläggare')
    // Wording unique to the rollback-failed branch.
    expect(mailSpy.mock.calls[0][0].body).toContain(
      'Kontaktdatabasen har därmed en ändring som Tenfast aldrig fått veta om'
    )
    expect(mailSpy.mock.calls[0][0].body.toLowerCase()).toContain(
      'ekonomisystemet'
    )
  })

  it('mails the alarm when the confirming resync after a successful rollback also fails', async () => {
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'unknown' })
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null } as any)

    const result = await addRelation(RECIPIENT)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'propagation-failed',
    })
    expect(mailSpy).toHaveBeenCalledTimes(1)
    expect(mailSpy.mock.calls[0][0].body).toContain('P111')
    expect(mailSpy.mock.calls[0][0].body).toContain('P222')
    expect(mailSpy.mock.calls[0][0].body).toContain('Anna Handläggare')
    expect(mailSpy.mock.calls[0][0].body).toContain(
      'Relationen togs bort igen i kontaktdatabasen'
    )
    // Add-direction wording: the risk is Tenfast still showing the reverted
    // relation. The remove direction's phrasing would be backwards here.
    expect(mailSpy.mock.calls[0][0].body).toContain(
      'Tenfast kan fortfarande visa den nya relationen'
    )
    expect(mailSpy.mock.calls[0][0].body).not.toContain('sakna relationen')
  })

  it('treats relation-not-found from the rollback as a completed rollback', async () => {
    // Someone else removed it first. The desired state already holds, so
    // alarming would send a human to repair nothing.
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    const syncSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValueOnce({ ok: false, err: 'sync-failed' })
      .mockResolvedValueOnce({ ok: true, data: { skipped: false } })
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: false, err: 'relation-not-found' })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockRejectedValue(NOT_CALLED)

    const result = await addRelation(RECIPIENT)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'propagation-failed',
    })
    expect(syncSpy).toHaveBeenCalledTimes(2)
    expect(mailSpy).not.toHaveBeenCalled()
  })

  it('alarms when the confirming resync fails after a cleanly rejected push too', async () => {
    // `sync-failed` is not proof Tenfast is untouched: leasing answers 500
    // both when Tenfast rejected the push and when Tenfast's own response was
    // lost, so this branch can still leave Tenfast holding the reverted
    // change. Staying quiet here would hide a real mismatch.
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'sync-failed' })
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null } as any)

    const result = await addRelation(RECIPIENT)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'propagation-failed',
    })
    expect(mailSpy).toHaveBeenCalledTimes(1)
  })

  it('logs the economy customer left behind when the relation is not saved', async () => {
    // The upsert runs before the write and no alarm fires on this path, so
    // the log is the only record that a customer was left behind.
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest.spyOn(contactsAdapter, 'addRelation').mockResolvedValue({
      ok: false,
      err: 'subject-not-found',
      statusCode: 404,
    })

    await addRelation(RECIPIENT)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ relatedContactCode: 'P222' }),
      'relationChanges.economyCustomerOrphaned'
    )
  })

  it('does not flag an orphaned economy customer when the relation already existed', async () => {
    // That customer exists because of the relation — it is in use.
    mockPresence([RECIPIENT_RELATION])
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest.spyOn(contactsAdapter, 'addRelation').mockResolvedValue({
      ok: false,
      err: 'duplicate-relation',
      statusCode: 409,
    })

    await addRelation(RECIPIENT)

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      'relationChanges.economyCustomerOrphaned'
    )
  })

  it('does not touch the economy service for a guardian role', async () => {
    const economySpy = jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockRejectedValue(NOT_CALLED)
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: true, data: { skipped: false } })

    const result = await addRelation(GUARDIAN)

    expect(result.processStatus).toBe(ProcessStatus.successful)
    expect(economySpy).not.toHaveBeenCalled()
  })

  it('treats a skipped Tenfast resync as success', async () => {
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: true, data: { skipped: true } })
    const removeSpy = jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockRejectedValue(NOT_CALLED)

    const result = await addRelation(RECIPIENT)

    expect(result.processStatus).toBe(ProcessStatus.successful)
    expect(removeSpy).not.toHaveBeenCalled()
  })

  it('passes a contacts-service rejection through with its own status and does not compensate', async () => {
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest.spyOn(contactsAdapter, 'addRelation').mockResolvedValue({
      ok: false,
      err: 'guardian-exists',
      statusCode: 409,
      detail: 'P999',
    })
    const syncSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockRejectedValue(NOT_CALLED)
    const removeSpy = jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockRejectedValue(NOT_CALLED)

    const result = await addRelation(GUARDIAN)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'guardian-exists',
      httpStatus: 409,
    })
    expect(syncSpy).not.toHaveBeenCalled()
    // A clean rejection (a defined statusCode) must not be treated as an
    // ambiguous write — compensating here would be over-compensation.
    expect(removeSpy).not.toHaveBeenCalled()
  })

  it('does not compensate for a contacts-service-error that carries a status code (a clean rejection)', async () => {
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest.spyOn(contactsAdapter, 'addRelation').mockResolvedValue({
      ok: false,
      err: 'contacts-service-error',
      statusCode: 500,
    })
    const removeSpy = jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockRejectedValue(NOT_CALLED)
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockRejectedValue(NOT_CALLED)

    const result = await addRelation(RECIPIENT)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'contacts-service-error',
      httpStatus: 502,
    })
    // A received response — even a 500 — is a clean rejection: only a lost
    // response (no statusCode at all) makes the write's fate ambiguous.
    expect(removeSpy).not.toHaveBeenCalled()
    expect(mailSpy).not.toHaveBeenCalled()
  })

  describe('when addRelation reports an unknown outcome (contacts-service-error with no statusCode)', () => {
    it('compensates with a best-effort removeRelation call', async () => {
      jest
        .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
        .mockResolvedValue({ ok: true, data: null })
      jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const removeSpy = jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: true, data: undefined })
      const syncSpy = jest
        .spyOn(leasingAdapter, 'syncContactToLeasing')
        .mockRejectedValue(NOT_CALLED)

      const result = await addRelation(RECIPIENT)

      expect(result).toMatchObject({
        processStatus: ProcessStatus.failed,
        error: 'contacts-service-error',
        httpStatus: 502,
      })
      expect(removeSpy).toHaveBeenCalledWith({
        contactCode: 'P111',
        relatedContactCode: 'P222',
        roleType: 'annan_fakturamottagare',
        deletedBy: 'Anna Handläggare (rollback)',
      })
      expect(syncSpy).not.toHaveBeenCalled()
    })

    it('alarms when the compensating remove reports relation-not-found, since the original write may still commit', async () => {
      // A lost response usually means core stopped waiting while the service
      // was still working, so the remove can land before the insert does.
      jest
        .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
        .mockResolvedValue({ ok: true, data: null })
      jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: false, err: 'relation-not-found' })
      const mailSpy = jest
        .spyOn(communicationAdapter, 'sendEmail')
        .mockResolvedValue({ ok: true, data: null } as any)

      await addRelation(RECIPIENT)

      expect(mailSpy).toHaveBeenCalledTimes(1)
      expect(mailSpy.mock.calls[0][0].body).toContain(
        'okänt om relationen skapades'
      )
    })

    it('matches the prior relation regardless of contact-code casing and padding', async () => {
      // The service answers with Xpand's spelling of a code but accepts
      // other casing and padding on input.
      mockPresence([RECIPIENT_RELATION])
      jest
        .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
        .mockResolvedValue({ ok: true, data: null })
      jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const removeSpy = jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockRejectedValue(NOT_CALLED)

      await addRelation({
        ...RECIPIENT,
        contactCode: ' p111 ',
        relatedContactCode: 'p222 ',
      })

      expect(removeSpy).not.toHaveBeenCalled()
    })

    it('does not compensate when the relation already existed before the write', async () => {
      // With the relation already there the add can only have been refused
      // as a duplicate, so removing here would destroy a live relation.
      mockPresence([RECIPIENT_RELATION])
      jest
        .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
        .mockResolvedValue({ ok: true, data: null })
      jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const removeSpy = jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockRejectedValue(NOT_CALLED)
      const mailSpy = jest
        .spyOn(communicationAdapter, 'sendEmail')
        .mockRejectedValue(NOT_CALLED)

      const result = await addRelation(RECIPIENT)

      expect(result).toMatchObject({
        processStatus: ProcessStatus.failed,
        error: 'contacts-service-error',
      })
      expect(removeSpy).not.toHaveBeenCalled()
      expect(mailSpy).not.toHaveBeenCalled()
    })

    it('reads presence per role, so the same contact in another role does not count', async () => {
      mockPresence([
        { ...RECIPIENT_RELATION, role: 'otherInvoiceRecipientFor' },
      ])
      jest
        .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
        .mockResolvedValue({ ok: true, data: null })
      jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const removeSpy = jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: true, data: undefined })

      await addRelation(RECIPIENT)

      // The reverse edge is the same relation seen from the other end, not
      // the one being written — compensation still applies.
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('alarms without compensating when the prior state could not be read', async () => {
      jest
        .spyOn(contactsAdapter, 'getByContactCodeBatch')
        .mockResolvedValue({ ok: false, err: 'unknown' })
      jest
        .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
        .mockResolvedValue({ ok: true, data: null })
      jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const removeSpy = jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockRejectedValue(NOT_CALLED)
      const mailSpy = jest
        .spyOn(communicationAdapter, 'sendEmail')
        .mockResolvedValue({ ok: true, data: null } as any)

      await addRelation(RECIPIENT)

      // A blind remove could delete a pre-existing relation.
      expect(removeSpy).not.toHaveBeenCalled()
      expect(mailSpy).toHaveBeenCalledTimes(1)
      expect(mailSpy.mock.calls[0][0].body).toContain(
        'ingen automatisk återställning'
      )
    })

    it('alarms when the compensating remove itself fails', async () => {
      jest
        .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
        .mockResolvedValue({ ok: true, data: null })
      jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const mailSpy = jest
        .spyOn(communicationAdapter, 'sendEmail')
        .mockResolvedValue({ ok: true, data: null } as any)

      const result = await addRelation(RECIPIENT)

      expect(result).toMatchObject({
        processStatus: ProcessStatus.failed,
        error: 'contacts-service-error',
        httpStatus: 502,
      })
      expect(mailSpy).toHaveBeenCalledTimes(1)
      expect(mailSpy.mock.calls[0][0].body).toContain('P111')
      expect(mailSpy.mock.calls[0][0].body).toContain('P222')
      expect(mailSpy.mock.calls[0][0].body).toContain('Anna Handläggare')
      // Write-outcome-unknown wording, and it must not claim Tenfast was
      // contacted — it never was on this path.
      expect(mailSpy.mock.calls[0][0].body).toContain(
        'okänt om relationen skapades'
      )
      expect(mailSpy.mock.calls[0][0].body).toContain('ta bort den')
      expect(mailSpy.mock.calls[0][0].body).not.toContain('Tenfast')
      // The remove direction's phrasing would say the opposite of both.
      expect(mailSpy.mock.calls[0][0].body).not.toContain('lägga tillbaka den')
      expect(mailSpy.mock.calls[0][0].body).not.toContain(
        'okänt om relationen togs bort'
      )
    })
  })

  it('does not mail the alarm when no alarm address is configured', async () => {
    ;(config.emailAddresses as Record<string, string>).xpandSync = ''
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'sync-failed' })
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockRejectedValue(NOT_CALLED)

    await addRelation(RECIPIENT)

    expect(mailSpy).not.toHaveBeenCalled()
  })

  it('caps the rollback actor at 100 characters even for a long createdBy', async () => {
    const longCreatedBy = 'A'.repeat(100)
    jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockResolvedValue({ ok: true, data: null })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'sync-failed' })
    const removeSpy = jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })

    await addRelation({ ...RECIPIENT, createdBy: longCreatedBy })

    const deletedBy = removeSpy.mock.calls[0][0].deletedBy
    expect(deletedBy.length).toBeLessThanOrEqual(100)
    // The marker must survive truncation — an audit row with it silently
    // dropped is indistinguishable from a normal write.
    expect(deletedBy).toMatch(/\(rollback\)$/)
  })
})

describe('removeRelation', () => {
  it('removes the relation and resyncs Tenfast, without touching the economy service', async () => {
    const removeSpy = jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    const syncSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: true, data: { skipped: false } })
    const economySpy = jest
      .spyOn(syncInvoiceRecipient, 'syncInvoiceRecipientToEconomy')
      .mockRejectedValue(NOT_CALLED)

    const result = await removeRelation(REMOVAL)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.successful,
      httpStatus: 204,
    })
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledWith(REMOVAL)
    expect(syncSpy).toHaveBeenCalledWith('P111')
    expect(economySpy).not.toHaveBeenCalled()
  })

  it('re-adds the relation when the Tenfast resync fails, then confirms the rollback with Tenfast', async () => {
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    const syncSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValueOnce({ ok: false, err: 'sync-failed' })
      .mockResolvedValueOnce({ ok: true, data: { skipped: false } })
    const addSpy = jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockRejectedValue(NOT_CALLED)

    const result = await removeRelation(REMOVAL)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'propagation-failed',
      httpStatus: 502,
      response: { detail: 'tenfast' },
    })
    expect(addSpy).toHaveBeenCalledWith({
      contactCode: 'P111',
      relatedContactCode: 'P222',
      roleType: 'annan_fakturamottagare',
      createdBy: 'Anna Handläggare (rollback)',
    })
    // Once for the failed original sync, once to confirm the rollback.
    expect(syncSpy).toHaveBeenCalledTimes(2)
    expect(mailSpy).not.toHaveBeenCalled()
  })

  it('mails the alarm and answers rollback-failed when the re-add also fails', async () => {
    mockPresence([RECIPIENT_RELATION])
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'sync-failed' })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null } as any)

    const result = await removeRelation(REMOVAL)

    // The removal stands in the database, so a retry can only answer
    // relation-not-found — the caseworker must not be told to try again.
    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'rollback-failed',
      httpStatus: 502,
    })
    expect(mailSpy).toHaveBeenCalledTimes(1)
    expect(mailSpy.mock.calls[0][0].to).toBe('sync@example.com')
    expect(mailSpy.mock.calls[0][0].body).toContain('P111')
    expect(mailSpy.mock.calls[0][0].body).toContain('P222')
    expect(mailSpy.mock.calls[0][0].body).toContain('togs bort')
    expect(mailSpy.mock.calls[0][0].body).toContain('Anna Handläggare')
    // Wording unique to the rollback-failed branch.
    expect(mailSpy.mock.calls[0][0].body).toContain(
      'Kontaktdatabasen har därmed en ändring som Tenfast aldrig fått veta om'
    )
    // The remove path never touches the economy service, so — unlike the add path's
    // equivalent alarm — no orphaned-customer footnote.
    expect(mailSpy.mock.calls[0][0].body.toLowerCase()).not.toContain(
      'ekonomisystemet'
    )
  })

  it('mails the alarm when the confirming resync after a successful re-add also fails', async () => {
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'unknown' })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null } as any)

    const result = await removeRelation(REMOVAL)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'propagation-failed',
    })
    expect(mailSpy).toHaveBeenCalledTimes(1)
    expect(mailSpy.mock.calls[0][0].body).toContain('P111')
    expect(mailSpy.mock.calls[0][0].body).toContain('P222')
    expect(mailSpy.mock.calls[0][0].body).toContain('Anna Handläggare')
    expect(mailSpy.mock.calls[0][0].body).toContain(
      'Relationen lades till igen i kontaktdatabasen'
    )
    // Remove-direction wording: the relation is back, so the risk is Tenfast
    // still thinking it gone. The add direction's phrasing is backwards here.
    expect(mailSpy.mock.calls[0][0].body).toContain(
      'Tenfast kan fortfarande sakna relationen'
    )
    expect(mailSpy.mock.calls[0][0].body).not.toContain('visa den')
  })

  it('treats duplicate-relation from the re-add as a completed rollback', async () => {
    // The relation is back — whether this call or a concurrent one put it
    // there. The desired state holds, so this is not a rollback failure.
    mockPresence([RECIPIENT_RELATION])
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    const syncSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValueOnce({ ok: false, err: 'sync-failed' })
      .mockResolvedValueOnce({ ok: true, data: { skipped: false } })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: false, err: 'duplicate-relation' })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockRejectedValue(NOT_CALLED)

    const result = await removeRelation(REMOVAL)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'propagation-failed',
    })
    expect(syncSpy).toHaveBeenCalledTimes(2)
    expect(mailSpy).not.toHaveBeenCalled()
  })

  it('alarms when the confirming resync fails after a cleanly rejected push too', async () => {
    // See the add-direction equivalent: a 500 out of leasing does not prove
    // Tenfast never saw the removal.
    mockPresence([RECIPIENT_RELATION])
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'sync-failed' })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockResolvedValue({ ok: true, data: null } as any)

    const result = await removeRelation(REMOVAL)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'propagation-failed',
    })
    expect(mailSpy).toHaveBeenCalledTimes(1)
  })

  it('treats a skipped Tenfast resync as success', async () => {
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: true, data: { skipped: true } })
    const addSpy = jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockRejectedValue(NOT_CALLED)

    const result = await removeRelation(REMOVAL)

    expect(result.processStatus).toBe(ProcessStatus.successful)
    expect(addSpy).not.toHaveBeenCalled()
  })

  it('passes a contacts-service rejection through without resyncing or compensating', async () => {
    jest.spyOn(contactsAdapter, 'removeRelation').mockResolvedValue({
      ok: false,
      err: 'relation-not-found',
      statusCode: 404,
      detail: 'no active relation found',
    })
    const syncSpy = jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockRejectedValue(NOT_CALLED)
    const addSpy = jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockRejectedValue(NOT_CALLED)

    const result = await removeRelation(REMOVAL)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'relation-not-found',
      httpStatus: 404,
      response: { detail: 'no active relation found' },
    })
    expect(syncSpy).not.toHaveBeenCalled()
    expect(addSpy).not.toHaveBeenCalled()
  })

  it('does not compensate for a contacts-service-error that carries a status code (a clean rejection)', async () => {
    jest.spyOn(contactsAdapter, 'removeRelation').mockResolvedValue({
      ok: false,
      err: 'contacts-service-error',
      statusCode: 500,
    })
    const addSpy = jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockRejectedValue(NOT_CALLED)
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockRejectedValue(NOT_CALLED)

    const result = await removeRelation(REMOVAL)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      error: 'contacts-service-error',
      httpStatus: 502,
    })
    // A received response — even a 500 — is a clean rejection, not an
    // unknown outcome: only a lost response (no statusCode at all) means
    // the write's fate is ambiguous.
    expect(addSpy).not.toHaveBeenCalled()
    expect(mailSpy).not.toHaveBeenCalled()
  })

  describe('when removeRelation reports an unknown outcome (contacts-service-error with no statusCode)', () => {
    it('compensates with a best-effort addRelation call', async () => {
      mockPresence([RECIPIENT_RELATION])
      jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const addSpy = jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: true, data: RELATIONS })
      const syncSpy = jest
        .spyOn(leasingAdapter, 'syncContactToLeasing')
        .mockRejectedValue(NOT_CALLED)

      const result = await removeRelation(REMOVAL)

      expect(result).toMatchObject({
        processStatus: ProcessStatus.failed,
        error: 'contacts-service-error',
        httpStatus: 502,
      })
      expect(addSpy).toHaveBeenCalledWith({
        contactCode: 'P111',
        relatedContactCode: 'P222',
        roleType: 'annan_fakturamottagare',
        createdBy: 'Anna Handläggare (rollback)',
      })
      expect(syncSpy).not.toHaveBeenCalled()
    })

    it('does not compensate when the relation did not exist before the write', async () => {
      // Nothing was there to delete, so the lost response can only have
      // carried a relation-not-found. Adding here would conjure a relation
      // nobody ever asked for.
      jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const addSpy = jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockRejectedValue(NOT_CALLED)
      const mailSpy = jest
        .spyOn(communicationAdapter, 'sendEmail')
        .mockRejectedValue(NOT_CALLED)

      const result = await removeRelation(REMOVAL)

      expect(result).toMatchObject({
        processStatus: ProcessStatus.failed,
        error: 'contacts-service-error',
      })
      expect(addSpy).not.toHaveBeenCalled()
      expect(mailSpy).not.toHaveBeenCalled()
    })

    it('alarms without compensating when the prior state could not be read', async () => {
      jest
        .spyOn(contactsAdapter, 'getByContactCodeBatch')
        .mockResolvedValue({ ok: false, err: 'unknown' })
      jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const addSpy = jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockRejectedValue(NOT_CALLED)
      const mailSpy = jest
        .spyOn(communicationAdapter, 'sendEmail')
        .mockResolvedValue({ ok: true, data: null } as any)

      await removeRelation(REMOVAL)

      expect(addSpy).not.toHaveBeenCalled()
      expect(mailSpy).toHaveBeenCalledTimes(1)
      expect(mailSpy.mock.calls[0][0].body).toContain(
        'ingen automatisk återställning'
      )
    })

    it('alarms when the compensating add reports duplicate-relation, since the original remove may still commit', async () => {
      mockPresence([RECIPIENT_RELATION])
      jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: false, err: 'duplicate-relation' })
      const mailSpy = jest
        .spyOn(communicationAdapter, 'sendEmail')
        .mockResolvedValue({ ok: true, data: null } as any)

      await removeRelation(REMOVAL)

      expect(mailSpy).toHaveBeenCalledTimes(1)
      expect(mailSpy.mock.calls[0][0].body).toContain(
        'okänt om relationen togs bort'
      )
    })

    it('matches the prior relation regardless of contact-code casing and padding', async () => {
      mockPresence([RECIPIENT_RELATION])
      jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const addSpy = jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: true, data: RELATIONS })

      await removeRelation({
        ...REMOVAL,
        contactCode: 'p111',
        relatedContactCode: ' P222',
      })

      // Read as present, so the lost remove is compensated.
      expect(addSpy).toHaveBeenCalledTimes(1)
    })

    it('alarms when the compensating add itself fails', async () => {
      mockPresence([RECIPIENT_RELATION])
      jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      jest
        .spyOn(contactsAdapter, 'addRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      const mailSpy = jest
        .spyOn(communicationAdapter, 'sendEmail')
        .mockResolvedValue({ ok: true, data: null } as any)

      const result = await removeRelation(REMOVAL)

      expect(result).toMatchObject({
        processStatus: ProcessStatus.failed,
        error: 'contacts-service-error',
        httpStatus: 502,
      })
      expect(mailSpy).toHaveBeenCalledTimes(1)
      expect(mailSpy.mock.calls[0][0].body).toContain('P111')
      expect(mailSpy.mock.calls[0][0].body).toContain('P222')
      expect(mailSpy.mock.calls[0][0].body).toContain('Anna Handläggare')
      // Unique to the write-outcome-unknown branch — distinguishes it from
      // the rollback-failed and resync-unconfirmed wordings, and must not
      // claim Tenfast was ever contacted (it never was on this path).
      // Remove-direction specific: the write whose outcome is unknown was a
      // removal, and the compensating write puts the relation back — a
      // copy-paste from the add suite would say the opposite of both.
      expect(mailSpy.mock.calls[0][0].body).toContain(
        'okänt om relationen togs bort'
      )
      expect(mailSpy.mock.calls[0][0].body).toContain('lägga tillbaka den')
      expect(mailSpy.mock.calls[0][0].body).not.toContain('Tenfast')
      expect(mailSpy.mock.calls[0][0].body).not.toContain(
        'okänt om relationen skapades'
      )
      expect(mailSpy.mock.calls[0][0].body).not.toContain('ta bort den')
    })

    it('alarms and carries guardian-exists when the compensating add finds the slot already claimed', async () => {
      // Our delete landed, then another caseworker claimed the guardian slot
      // with a different contact. The compensation correctly fails, and wrong
      // prose here would send an engineer to delete that new relation.
      mockPresence([
        {
          contactCode: 'P333',
          role: 'trustee',
          fullName: 'Gustav God Man',
          firstName: 'Gustav',
          lastName: 'God Man',
        },
      ])
      jest
        .spyOn(contactsAdapter, 'removeRelation')
        .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
      jest.spyOn(contactsAdapter, 'addRelation').mockResolvedValue({
        ok: false,
        err: 'guardian-exists',
        statusCode: 409,
        detail: 'P444',
      })
      const mailSpy = jest
        .spyOn(communicationAdapter, 'sendEmail')
        .mockResolvedValue({ ok: true, data: null } as any)

      const result = await removeRelation(GUARDIAN_REMOVAL)

      expect(result).toMatchObject({
        processStatus: ProcessStatus.failed,
        error: 'contacts-service-error',
        httpStatus: 502,
      })
      expect(mailSpy).toHaveBeenCalledTimes(1)
      expect(mailSpy.mock.calls[0][0].body).toContain('guardian-exists')
      expect(mailSpy.mock.calls[0][0].body).toContain('lägga tillbaka den')
    })
  })

  it('does not mail the alarm when no alarm address is configured', async () => {
    ;(config.emailAddresses as Record<string, string>).xpandSync = ''
    mockPresence([RECIPIENT_RELATION])
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'sync-failed' })
    jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: false, err: 'contacts-service-error' })
    const mailSpy = jest
      .spyOn(communicationAdapter, 'sendEmail')
      .mockRejectedValue(NOT_CALLED)

    await removeRelation(REMOVAL)

    expect(mailSpy).not.toHaveBeenCalled()
  })

  it('caps the rollback actor at 100 characters even for a long deletedBy', async () => {
    const longDeletedBy = 'A'.repeat(100)
    jest
      .spyOn(contactsAdapter, 'removeRelation')
      .mockResolvedValue({ ok: true, data: undefined })
    jest
      .spyOn(leasingAdapter, 'syncContactToLeasing')
      .mockResolvedValue({ ok: false, err: 'sync-failed' })
    const addSpy = jest
      .spyOn(contactsAdapter, 'addRelation')
      .mockResolvedValue({ ok: true, data: RELATIONS })

    await removeRelation({
      ...REMOVAL,
      deletedBy: longDeletedBy,
    })

    const createdBy = addSpy.mock.calls[0][0].createdBy
    expect(createdBy.length).toBeLessThanOrEqual(100)
    // The marker must survive truncation — an audit row with it silently
    // dropped is indistinguishable from a normal write.
    expect(createdBy).toMatch(/\(rollback\)$/)
  })
})

describe('addRelationStatus', () => {
  it.each([
    ['subject-not-found', 400, 400],
    ['related-not-found', 404, 404],
    ['guardian-exists', 409, 409],
    ['duplicate-relation', 409, 409],
    ['self-relation', 422, 422],
  ] as const)('maps %s at %i to %i', (err, statusCode, expected) => {
    expect(addRelationStatus(err, statusCode)).toBe(expected)
  })

  it('falls back to 502 when no status code is carried', () => {
    expect(addRelationStatus('subject-not-found', undefined)).toBe(502)
  })

  it('maps contacts-service-error to 502 regardless of the status code carried', () => {
    expect(addRelationStatus('contacts-service-error', 400)).toBe(502)
    expect(addRelationStatus('contacts-service-error', 409)).toBe(502)
    expect(addRelationStatus('contacts-service-error', undefined)).toBe(502)
  })
})

describe('removeRelationStatus', () => {
  it.each([
    ['relation-not-found', 404, 404],
    ['invalid-request', 400, 400],
  ] as const)('maps %s at %i to %i', (err, statusCode, expected) => {
    expect(removeRelationStatus(err, statusCode)).toBe(expected)
  })

  it('falls back to 502 when no status code is carried', () => {
    expect(removeRelationStatus('relation-not-found', undefined)).toBe(502)
  })

  it('falls back to 502 for a status code outside its allowlist (400, 404)', () => {
    expect(removeRelationStatus('relation-not-found', 409)).toBe(502)
  })

  it('maps contacts-service-error to 502 regardless of the status code carried', () => {
    expect(removeRelationStatus('contacts-service-error', 400)).toBe(502)
    expect(removeRelationStatus('contacts-service-error', 404)).toBe(502)
    expect(removeRelationStatus('contacts-service-error', undefined)).toBe(502)
  })
})
