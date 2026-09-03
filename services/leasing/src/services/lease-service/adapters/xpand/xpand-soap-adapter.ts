import soapRequest from 'easy-soap-request'
import { XMLParser } from 'fast-xml-parser'
import createHttpError from 'http-errors'

import Config from '../../../../common/config'
import { logger } from '@onecore/utilities'
import { AdapterResult } from '../types'
import { WaitingListType } from '@onecore/types'

/**
 * The Xpand queue captions each waiting-list type maps to.
 *
 * These strings must match rows in Xpand's `bkkty` table exactly. Xpand does
 * not create a queue it does not know — it answers `Success: false` with
 * "Kötyp saknas", the same response it gives for a nonsense string.
 *
 * Housing spans four separate queues. An applicant registering on mimer.nu is
 * placed in all four, so anyone registered through ONECore must land in the
 * same set, or the two registration paths produce differently queued customers.
 *
 * Typed as a total Record so that adding a waiting-list type is a compile
 * error here rather than a silent runtime fallthrough.
 */
const WAITING_LIST_CAPTIONS: Record<WaitingListType, ReadonlyArray<string>> = {
  [WaitingListType.Housing]: ['Bostad', 'Nyproduktion', 'Kooperativ', 'Ungdom'],
  [WaitingListType.ParkingSpace]: ['Bilplats (intern)', 'Bilplats (extern)'],
  [WaitingListType.Storage]: ['Förråd (intern)', 'Förråd (extern)'],
}

const addApplicantToToWaitingList = async (
  contactCode: string,
  waitingListType: WaitingListType
): Promise<
  AdapterResult<
    undefined,
    | 'unknown'
    | 'waiting-list-type-not-implemented'
    | 'waiting-list-type-not-found'
  >
> => {
  const captions = WAITING_LIST_CAPTIONS[waitingListType]

  if (!captions) {
    logger.error(
      { waitingListType },
      'addApplicantToToWaitingList: waiting list type not implemented'
    )
    return { ok: false, err: 'waiting-list-type-not-implemented' }
  }

  // Sequential rather than concurrent: these are writes against the same
  // contact, and Xpand's own registration flow issues them one at a time.
  //
  // 'already-in-waiting-list' is benign and must not abort: one type spans
  // several captions, and a contact may already hold some of them. Stopping
  // at the first would leave the remaining captions unattempted while the
  // route still reports success. Skipping makes enrolment idempotent, which
  // also removes the error from this function's result type.
  for (const caption of captions) {
    const result = await addToWaitingList(contactCode, caption)
    if (!result.ok && result.err !== 'already-in-waiting-list') {
      return { ok: false, err: result.err }
    }
  }

  return { ok: true, data: undefined }
}

/**
 * Xpand's messages are free text and vary in wording and capitalisation for
 * what is the same condition — the same state has been observed as both
 * "Sökanden saknas" and "Sökande Saknas". Match loosely rather than on exact
 * equality, or a message variant silently falls through to the unknown branch.
 */
const messageMatches = (message: unknown, pattern: RegExp): boolean =>
  typeof message === 'string' && pattern.test(message.trim())

/**
 * Xpand's response when the caption does not match any row in `bkkty`.
 * Indistinguishable from sending an entirely made-up string, so it means the
 * caption is wrong — not that anything is wrong with the contact.
 */
const UNKNOWN_QUEUE_TYPE = /kötyp\s+saknas/i

/** Xpand's response when the contact is already queued for that type. */
const ALREADY_IN_QUEUE = /kötyp\s+finns\s+redan/i

/** Xpand's response when removing a queue time the contact does not have. */
const NOT_IN_QUEUE = /kötid\s+saknas/i

const addToWaitingList = async (
  contactCode: string,
  waitingListTypeCaption: string
): Promise<
  AdapterResult<
    undefined,
    | 'already-in-waiting-list'
    | 'unknown'
    | 'waiting-list-type-not-implemented'
    | 'waiting-list-type-not-found'
  >
> => {
  const headers = getHeaders()

  const xml = `
   <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ser="http://incit.xpand.eu/service/" xmlns:inc="http://incit.xpand.eu/">
   <soap:Header xmlns:wsa='http://www.w3.org/2005/08/addressing'><wsa:Action>http://incit.xpand.eu/service/AddApplicantWaitingListTime/AddApplicantWaitingListTime</wsa:Action><wsa:To>${Config.xpandSoap.url}</wsa:To></soap:Header>
     <soap:Body>
        <ser:AddApplicantWaitingListTimeRequest>
        <inc:Code>${contactCode}</inc:Code>
        <inc:CompanyCode>001</inc:CompanyCode>
        <inc:MessageCulture>${Config.xpandSoap.messageCulture}</inc:MessageCulture>
        <inc:WaitingListTypeCaption>${waitingListTypeCaption}</inc:WaitingListTypeCaption> 
        </ser:AddApplicantWaitingListTimeRequest>
    </soap:Body>
</soap:Envelope>`

  try {
    const { response } = await soapRequest({
      url: Config.xpandSoap.url,
      headers: headers,
      xml: xml,
    })
    const { body } = response

    const options = {
      ignoreAttributes: false,
      ignoreNameSpace: false,
      removeNSPrefix: true,
    }

    const parser = new XMLParser(options)
    const parsedResponse = parser.parse(body)['Envelope']['Body']['ResultBase']

    if (parsedResponse.Success) {
      return { ok: true, data: undefined }
    } else if (messageMatches(parsedResponse['Message'], ALREADY_IN_QUEUE)) {
      logger.error(
        `Add to waiting list failed for ${waitingListTypeCaption}: ${parsedResponse['Message']}`
      )
      return { ok: false, err: 'already-in-waiting-list' }
    } else if (messageMatches(parsedResponse['Message'], UNKNOWN_QUEUE_TYPE)) {
      // A caption that does not exist in Xpand. This is a bug in our mapping,
      // not a problem with the contact, and previously surfaced as 'unknown' —
      // which is why a wrong housing caption went unnoticed.
      logger.error(
        { waitingListTypeCaption },
        'addToWaitingList: unknown queue type in Xpand'
      )
      return { ok: false, err: 'waiting-list-type-not-found' }
    } else {
      logger.error(
        `Add to waiting list failed with unknown error for ${waitingListTypeCaption}: ${parsedResponse['Message']}`
      )
      return { ok: false, err: 'unknown' }
    }
  } catch (error) {
    logger.error(
      error,
      'Error adding applicant to waitinglist using Xpand SOAP API for list ' +
        waitingListTypeCaption
    )
    return { ok: false, err: 'unknown' }
  }
}

const removeApplicantFromWaitingList = async (
  contactCode: string,
  waitingListType: WaitingListType
): Promise<
  AdapterResult<
    undefined,
    | 'unknown'
    | 'waiting-list-type-not-implemented'
    | 'waiting-list-type-not-found'
  >
> => {
  const captions = WAITING_LIST_CAPTIONS[waitingListType]

  if (!captions) {
    logger.error(
      { waitingListType },
      'removeApplicantFromWaitingList: waiting list type not implemented'
    )
    return { ok: false, err: 'waiting-list-type-not-implemented' }
  }

  // Mirrors the add loop: 'not-in-waiting-list' is benign and must not abort.
  // One type spans several captions and a contact rarely holds all of them, so
  // stopping at the first would leave the remaining captions still queued while
  // the caller reports the removal as done. That is how a reset could leave a
  // contact's queue time intact after they had already won an offer.
  for (const caption of captions) {
    const result = await removeFromWaitingList(contactCode, caption)
    if (!result.ok && result.err !== 'not-in-waiting-list') {
      return { ok: false, err: result.err }
    }
  }

  return { ok: true, data: undefined }
}
const removeFromWaitingList = async (
  contactCode: string,
  waitingListTypeCaption: string
): Promise<
  AdapterResult<
    undefined,
    'not-in-waiting-list' | 'unknown' | 'waiting-list-type-not-found'
  >
> => {
  const headers = getHeaders()

  const xml = `
   <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ser="http://incit.xpand.eu/service/" xmlns:inc="http://incit.xpand.eu/">
   <soap:Header xmlns:wsa='http://www.w3.org/2005/08/addressing'><wsa:Action>http://incit.xpand.eu/service/RemoveApplicantWaitingListTime/RemoveApplicantWaitingListTime</wsa:Action><wsa:To>${Config.xpandSoap.url}</wsa:To></soap:Header>
     <soap:Body>
        <ser:RemoveApplicantWaitingListTimeRequest>
          <inc:Code>${contactCode}</inc:Code>
          <inc:CompanyCode>001</inc:CompanyCode>
          <inc:MessageCulture>${Config.xpandSoap.messageCulture}</inc:MessageCulture>
          <inc:WaitingListTypeCaption>${waitingListTypeCaption}</inc:WaitingListTypeCaption> 
        </ser:RemoveApplicantWaitingListTimeRequest>
    </soap:Body>
</soap:Envelope>`

  try {
    const { response } = await soapRequest({
      url: Config.xpandSoap.url,
      headers: headers,
      xml: xml,
    })
    const { body } = response

    const options = {
      ignoreAttributes: false,
      ignoreNameSpace: false,
      removeNSPrefix: true,
    }

    const parser = new XMLParser(options)
    const parsedResponse = parser.parse(body)['Envelope']['Body']['ResultBase']

    if (parsedResponse.Success) return { ok: true, data: undefined }
    else if (messageMatches(parsedResponse['Message'], NOT_IN_QUEUE)) {
      logger.error(
        `Remove from waiting list failed for ${waitingListTypeCaption}: ${parsedResponse['Message']}`
      )
      return { ok: false, err: 'not-in-waiting-list' }
    } else if (messageMatches(parsedResponse['Message'], UNKNOWN_QUEUE_TYPE)) {
      logger.error(
        { waitingListTypeCaption },
        'removeFromWaitingList: unknown queue type in Xpand'
      )
      return { ok: false, err: 'waiting-list-type-not-found' }
    } else {
      logger.error(
        `Remove from waiting list failed with unkown error ${waitingListTypeCaption}: ${parsedResponse['Message']}`
      )
      return { ok: false, err: 'unknown' }
    }
  } catch (error) {
    logger.error(
      error,
      'Error removing applicant from waitinglist using Xpand SOAP API. waitingListTypeCaption: ' +
        waitingListTypeCaption
    )
    return { ok: false, err: 'unknown' }
  }
}

async function getPublishedParkingSpaces(): Promise<
  AdapterResult<any[], 'not-found' | 'unknown'>
> {
  const headers = getHeaders()

  const xml = `
   <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ser="http://incit.xpand.eu/service/" xmlns:inc="http://incit.xpand.eu/">
   <soap:Header xmlns:wsa='http://www.w3.org/2005/08/addressing'><wsa:Action>http://incit.xpand.eu/service/IGetPublishedParkings08352/GetPublishedParkings08352_NotLoggedOn</wsa:Action><wsa:To>${Config.xpandSoap.url}</wsa:To></soap:Header>
   <soap:Body>
      <ser:GetPublishedRentalObjectsRequest08352>
        <inc:CompanyCode>001</inc:CompanyCode>
         <inc:MessageCulture>${Config.xpandSoap.messageCulture}</inc:MessageCulture>
      </ser:GetPublishedRentalObjectsRequest08352>
   </soap:Body>
</soap:Envelope>`
  try {
    const { response } = await soapRequest({
      url: Config.xpandSoap.url,
      headers: headers,
      xml: xml,
    })
    const { body } = response

    const options = {
      ignoreAttributes: false,
      ignoreNameSpace: false,
      removeNSPrefix: true,
    }

    const parser = new XMLParser(options)

    const parsedResponse =
      parser.parse(body)['Envelope']['Body']['PublishedRentalObjectResult08352']

    if (!parsedResponse['PublishedRentalObjects08352']) {
      return { ok: false, err: 'not-found' }
    }

    return {
      ok: true,
      data: parsedResponse['PublishedRentalObjects08352'][
        'PublishedRentalObjectDataContract08352'
      ],
    }
  } catch (err) {
    logger.error(
      err,
      'Error getting published parking spaces using Xpand SOAP API'
    )
    return { ok: false, err: 'unknown' }
  }
}

async function getPublishedInternalParkingSpaces(): Promise<
  AdapterResult<any[], 'not-found' | 'unknown'>
> {
  const result = await getPublishedParkingSpaces()
  if (!result.ok) {
    return { ok: false, err: result.err }
  }

  return {
    ok: true,
    data: result.data.filter((v) => v.WaitingListType === 'Bilplats (intern)'),
  }
}

const healthCheck = async () => {
  const result = await getPublishedParkingSpaces()
  if (!result.ok) {
    throw createHttpError(404, 'Published Parking Spaces not found')
  }
}

function getHeaders() {
  const base64credentials = Buffer.from(
    Config.xpandSoap.username + ':' + Config.xpandSoap.password
  ).toString('base64')

  return {
    'Content-Type': 'application/soap+xml;charset=UTF-8;',
    'user-agent': 'onecore-xpand-soap-adapter',
    Authorization: `Basic ${base64credentials}`,
  }
}

export {
  addApplicantToToWaitingList,
  removeApplicantFromWaitingList,
  healthCheck,
  getPublishedInternalParkingSpaces,
}
