import soapRequest from 'easy-soap-request'
import { XMLParser } from 'fast-xml-parser'
import createHttpError from 'http-errors'

import Config from '../../../../common/config'
import { WaitingList } from 'onecore-types'

const createLease = async (
  fromDate: Date,
  rentalPropertyId: string,
  tenantCode: string,
  companyCode: string
) => {
  const headers = getHeaders()

  const xml = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ser="http://incit.xpand.eu/service/" xmlns:inc="http://incit.xpand.eu/" xmlns:data="http://incit.xpand.eu/data/">
  <soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing"><wsa:Action>http://incit.xpand.eu/service/CreateRentContract/CreateRentContract</wsa:Action><wsa:To>${Config.xpandSoap.url}</wsa:To></soap:Header>
  <soap:Body>
     <ser:CreateRentContractRequest>
        <!--Optional:-->
        <inc:CompanyCode>${companyCode}</inc:CompanyCode>
        <!--Optional:-->
        <inc:ContractFromDate>${fromDate.toLocaleDateString('sv-SE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })}</inc:ContractFromDate>
        <!--Optional:<inc:ContractToDate></inc:ContractToDate> Måste ta bort den helt-->
        <!--Optional:-->
        <inc:MessageCulture>${
          Config.xpandSoap.messageCulture
        }</inc:MessageCulture>
        <!--Optional:-->
        <inc:MovingFromId/>
        <!--Optional:-->
        <inc:PreviousResidenceId/>
        <!--Optional:-->
        <inc:ReasonId/>
        <!--Optional:-->
        <inc:RentalObjectCode>${rentalPropertyId}</inc:RentalObjectCode>
        <!--Optional:-->
        <inc:RentalObjectId/>
        <!--Optional:-->
        <inc:Tenants>
           <!--Zero or more repetitions:-->
           <data:TenantCode>
              <!--Optional: <data:TenantCode>P174965</data:TenantCode> -->
              <data:TenantCode>${tenantCode}</data:TenantCode>
              <!--Optional:-->
              <data:TenantId/>
           </data:TenantCode>
        </inc:Tenants>
     </ser:CreateRentContractRequest>
  </soap:Body>
</soap:Envelope>`

  try {
    const { response } = await soapRequest({
      url: Config.xpandSoap.url,
      headers: headers,
      xml: xml,
    })
    const { body } = response

    const parser: XMLParser = new XMLParser()
    const parsedResponse =
      parser.parse(body)['s:Envelope']['s:Body'].CreateNewEntityResult

    if (parsedResponse.Success === true) {
      return parsedResponse.ObjectDescription
    } else if (parsedResponse.Message == 'Hyresobjekt saknas.') {
      throw createHttpError(404, 'Parking space not found')
    }
    throw createHttpError(500, parsedResponse.Message)
    //TODO: handle more errors...
  } catch (error: unknown) {
    console.error(error)
    throw error
  }
}

const getWaitingList = async (nationalRegistrationNumber: string) => {
  const headers = getHeaders()

  var xml = `
   <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ser="http://incit.xpand.eu/service/" xmlns:inc="http://incit.xpand.eu/">
   <soap:Header xmlns:wsa='http://www.w3.org/2005/08/addressing'><wsa:Action>http://incit.xpand.eu/service/GetWaitingListTimes/GetWaitingListTimes</wsa:Action><wsa:To>${Config.xpandSoap.url}</wsa:To></soap:Header>
   <soap:Body>
      <ser:GetDataByContactRequest>
         <inc:CivicNumber>${nationalRegistrationNumber}</inc:CivicNumber><!--add as param:-->
         <inc:CompanyCode>001</inc:CompanyCode>
         <inc:MessageCulture>${Config.xpandSoap.messageCulture}</inc:MessageCulture>
      </ser:GetDataByContactRequest>
   </soap:Body>
</soap:Envelope>`

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
    parser.parse(body)['Envelope']['Body']['GetWaitingListTimeResult']

  if (!parsedResponse['WaitingListTimes']) {
    throw createHttpError(404, 'Waiting lists not found')
  } else {
    try {
      const waitingList: WaitingList[] = []

      for (const item of parsedResponse['WaitingListTimes'][
        'WaitingListTimeDataContract'
      ]) {
        const newItem: WaitingList = {
          applicantCaption: item.ApplicantCaption,
          contactCode: item.ApplicantCode,
          contractFromApartment: new Date(item.ContractFromApartment),
          queuePoints: item.QueuePoints,
          queuePointsSocialConnection: item.QueuePointsSocialConnection,
          waitingListFrom: new Date(item.WaitingListFrom),
          waitingListTypeCaption: item.WaitingListTypeCaption,
        }

        waitingList.push(newItem)
      }
      return waitingList
    } catch (e) {
      throw createHttpError(500, 'Unknown error when parsing body')
    }
  }
}

const addApplicantToToWaitingList = async (
  nationalRegistrationNumber: string,
  contactCode: string,
  waitingListTypeCaption: string
) => {
  const headers = getHeaders()

  var xml = `
   <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:ser="http://incit.xpand.eu/service/" xmlns:inc="http://incit.xpand.eu/">
   <soap:Header xmlns:wsa='http://www.w3.org/2005/08/addressing'><wsa:Action>http://incit.xpand.eu/service/AddApplicantWaitingListTime/AddApplicantWaitingListTime</wsa:Action><wsa:To>${Config.xpandSoap.url}</wsa:To></soap:Header>
     <soap:Body>
        <ser:AddApplicantWaitingListTimeRequest>
        <inc:CivicNumber>${nationalRegistrationNumber}</inc:CivicNumber>
        <inc:Code>${contactCode}</inc:Code>
        <inc:CompanyCode>001</inc:CompanyCode>
        <inc:MessageCulture>${Config.xpandSoap.messageCulture}</inc:MessageCulture>
        <inc:WaitingListTypeCaption>${waitingListTypeCaption}</inc:WaitingListTypeCaption> 
        </ser:AddApplicantWaitingListTimeRequest>
    </soap:Body>
</soap:Envelope>`

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

  try {
    if (parsedResponse.Success) {
      return
    } else if (parsedResponse['Message'] == 'Kötyp finns redan') {
      throw createHttpError(409, 'Applicant already in waiting list')
    } else {
      throw createHttpError(
        500,
        `unknown error when adding applicant to waiting list: ${parsedResponse['Message']}`
      )
    }
  } catch (error) {
    console.error(error)
    throw error
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

export { createLease, getWaitingList, addApplicantToToWaitingList }
