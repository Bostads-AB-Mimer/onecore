import soapRequest from 'easy-soap-request'
import { XMLParser } from 'fast-xml-parser'
import createHttpError from 'http-errors'
import Config from '../../../common/config'
import { XpandParkingSpace } from '../../../types/xpandTypes'
import { getParkingSpaceApplicationCategory, getParkingSpaceType } from '../../../utils/parking-spaces'


const getPublishedParkingSpaceFromSoapService = async (
  parkingSpaceId: string,
) => {
  const base64credentials = Buffer.from(
    Config.xpandSoap.username + ':' + Config.xpandSoap.password,
  ).toString('base64')
  const sampleHeaders = {
    'Content-Type': 'application/soap+xml;charset=UTF-8;',
    'user-agent': 'onecore-xpand-soap-adapter',
    Authorization: `Basic ${base64credentials}`,
  }

  const xml = `<soap:Envelope xmlns:soap='http://www.w3.org/2003/05/soap-envelope' xmlns:ser='http://incit.xpand.eu/service/' xmlns:inc='http://incit.xpand.eu/'>
  <soap:Header xmlns:wsa='http://www.w3.org/2005/08/addressing'><wsa:Action>http://incit.xpand.eu/service/IGetPublishedParkings08352/GetPublishedParkings08352</wsa:Action><wsa:To>https://pdatest.mimer.nu:9055/Incit/Service/External/ServiceCatalogue/</wsa:To></soap:Header>
   <soap:Body>
      <ser:GetPublishedRentalObjectsRequest08352>
         <inc:CompanyCode>001</inc:CompanyCode>
         <inc:IgnoreImageUrls>true</inc:IgnoreImageUrls>
         <inc:RentId>${parkingSpaceId}</inc:RentId>
      </ser:GetPublishedRentalObjectsRequest08352>
   </soap:Body>
</soap:Envelope>`

  const { response } = await soapRequest({
    url: Config.xpandSoap.url,
    headers: sampleHeaders,
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

  if (parsedResponse.PublishedRentalObjects08352 !== '') {
    const publishedRentalObject = parsedResponse.PublishedRentalObjects08352.PublishedRentalObjectDataContract08352
    //todo: fetch more fields from xpand db? the soap service does not include detailed address for example
    try {
      const parkingSpace: XpandParkingSpace = {
        parkingSpaceId: publishedRentalObject['RentalObjectCode'],
        address: {
          street: publishedRentalObject['Address1'],
          number: '',
          postalCode: '',
          city: '',
        },
        vacantFrom: publishedRentalObject['VacantFrom'],
        publishedFrom: publishedRentalObject['PublishedFrom'],
        publishedTo: publishedRentalObject['PublishedTo'],
        freeTable1Caption: publishedRentalObject['FreeTable1Caption'],
        freeTable1Code: publishedRentalObject['FreeTable1Code'],
        freeTable3Caption: publishedRentalObject['FreeTable3Caption'],
        freeTable3Code: publishedRentalObject['FreeTable3Code'],
        rent: {
          currentRent: {
            leaseId: undefined,
            rentId: undefined,
            currentRent: publishedRentalObject['MonthRent'],
            vat: 0,
            additionalChargeAmount: undefined,
            additionalChargeDescription: undefined,
            rentStartDate: undefined,
            rentEndDate: undefined,
          },
          futureRents: [],
        },
        type: getParkingSpaceType(publishedRentalObject['ObjectTypeCode']),
        applicationCategory: getParkingSpaceApplicationCategory(
          publishedRentalObject['WaitingListType']
        ),
        waitingListType: publishedRentalObject['WaitingListType'],
        rentalObjectTypeCaption: publishedRentalObject['RentalObjectTypeCaption'],
        rentalObjectTypeCode: publishedRentalObject['RentalObjectTypeCode'],
        objectTypeCaption: publishedRentalObject['ObjectTypeCaption'],
        objectTypeCode: publishedRentalObject['ObjectTypeCode'],
      }
      return parkingSpace
    } catch (e) {
      throw createHttpError(500, 'Unknown error when parsing body')
    }


  } else if (parsedResponse.PublishedRentalObjects08352 === '') {
    throw createHttpError(404, 'Parking space not found')
  }
}

export { getPublishedParkingSpaceFromSoapService }
