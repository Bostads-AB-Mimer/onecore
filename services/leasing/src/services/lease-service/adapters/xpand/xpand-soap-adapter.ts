import soapRequest from 'easy-soap-request'
import { XMLParser } from 'fast-xml-parser'
import createHttpError from 'http-errors'

import Config from '../../../../common/config'
import { logger } from '@onecore/utilities'
import { AdapterResult } from '../types'
import { WaitingListType } from '@onecore/types'

const addApplicantToToWaitingList = async (
  contactCode: string,
  waitingListType: WaitingListType
): Promise<
  AdapterResult<
    undefined,
    'already-in-waiting-list' | 'unknown' | 'waiting-list-type-not-implemented'
  >
> => {
  if (waitingListType == WaitingListType.ParkingSpace) {
    const resultInternalParkingSpace = await addToWaitingList(
      contactCode,
      'Bilplats (intern)'
    )
    const resultExternalParkingSpace = await addToWaitingList(
      contactCode,
      'Bilplats (extern)'
    )

    if (resultInternalParkingSpace.ok && resultExternalParkingSpace.ok)
      return { ok: true, data: undefined }
    if (!resultInternalParkingSpace.ok) return resultInternalParkingSpace
    if (!resultExternalParkingSpace.ok) return resultExternalParkingSpace
  }

  if (waitingListType == WaitingListType.Housing) {
    const result = await addToWaitingList(contactCode, 'Bostad (intern)')
    return result
  }

  if (waitingListType == WaitingListType.Storage) {
    const result = await addToWaitingList(contactCode, 'Förråd (intern)')
    return result
  }

  logger.error(
    `Add to Waiting list type ${waitingListType} not implemented yet`
  )
  return { ok: false, err: 'waiting-list-type-not-implemented' }
}

const addToWaitingList = async (
  contactCode: string,
  waitingListTypeCaption: string
): Promise<
  AdapterResult<
    undefined,
    'already-in-waiting-list' | 'unknown' | 'waiting-list-type-not-implemented'
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
    } else if (parsedResponse['Message'] == 'Kötyp finns redan') {
      logger.error(
        `Add to waiting list failed for ${waitingListTypeCaption}: ${parsedResponse['Message']}`
      )
      return { ok: false, err: 'already-in-waiting-list' }
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
    'not-in-waiting-list' | 'unknown' | 'waiting-list-type-not-implemented'
  >
> => {
  if (waitingListType == WaitingListType.ParkingSpace) {
    const resultInternalParkingSpace = await removeFromWaitingList(
      contactCode,
      'Bilplats (intern)'
    )
    const resultExternalParkingSpace = await removeFromWaitingList(
      contactCode,
      'Bilplats (extern)'
    )

    if (resultInternalParkingSpace.ok && resultExternalParkingSpace.ok)
      return { ok: true, data: undefined }
    if (!resultInternalParkingSpace.ok) return resultInternalParkingSpace
    if (!resultExternalParkingSpace.ok) return resultExternalParkingSpace
  }

  if (waitingListType == WaitingListType.Housing) {
    const result = await removeFromWaitingList(contactCode, 'Bostad (intern)')
    return result
  }

  if (waitingListType == WaitingListType.Storage) {
    const result = await removeFromWaitingList(contactCode, 'Förråd (intern)')
    return result
  }

  logger.error(
    `Remove from Waiting list type ${waitingListType} not implemented yet`
  )
  return { ok: false, err: 'waiting-list-type-not-implemented' }
}
const removeFromWaitingList = async (
  contactCode: string,
  waitingListTypeCaption: string
): Promise<AdapterResult<undefined, 'not-in-waiting-list' | 'unknown'>> => {
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
    else if (parsedResponse['Message'] == 'Kötid saknas') {
      logger.error(
        `Remove from waiting list failed for ${waitingListTypeCaption}: ${parsedResponse['Message']}`
      )
      return { ok: false, err: 'not-in-waiting-list' }
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
