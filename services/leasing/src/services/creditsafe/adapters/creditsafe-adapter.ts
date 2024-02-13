import soapRequest from 'easy-soap-request'
import dedent from 'dedent'
import { XMLParser } from 'fast-xml-parser'
import { format } from '../../../helpers/personnummer'
import { ConsumerReport, ConsumerReportError } from 'onecore-types'
import config from '../../../common/config'

const CASXML = (pnr: string) => dedent`
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <CasPersonService xmlns="https://webservice.creditsafe.se/CAS/">
          <cas_person>
            <account>
              <UserName>${config.creditsafe.username}</UserName>
              <Password>${config.creditsafe.password}</Password>
              <Language>SWE</Language>
            </account>
            <SearchNumber>${pnr}</SearchNumber>
            <Templates>${config.creditsafe.template}</Templates>
          </cas_person>
        </CasPersonService>
      </soap:Body>
    </soap:Envelope>
  `
const getConsumerReport = async (pnr: string): Promise<ConsumerReport> => {
  const xml = CASXML(pnr)
  const url = config.creditsafe.url

  try {
    const { response } = await soapRequest({
      url: url,
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
      },
      xml: xml,
    })

    const { body } = response

    const parser = new XMLParser()
    const parsedResponse = parser.parse(body)
    const data =
      parsedResponse['soap:Envelope']['soap:Body']['CasPersonServiceResponse'][
        'CasPersonServiceResult'
      ]

    return {
      pnr,
      template: data.TemplateNames,
      status: data.Status.toString(),
      status_text: data.Status_Text,
      errorList:
        [data.ErrorList.ERROR].flatMap((error: ConsumerReportError) => error) ||
        [],
      name: `${data.FirstName} ${data.LastName}`,
      address: data.Address,
      zip: data.ZIP?.toString(),
      city: data.Town,
    }
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const getCreditInformation = async (
  pnr: string
): Promise<ConsumerReport> => {
  try {
    const formattedPnr = format(pnr)
    const info = await getConsumerReport(formattedPnr)

    return info
  } catch (error) {
    console.error(error)
    return Promise.reject(error)
  }
}
