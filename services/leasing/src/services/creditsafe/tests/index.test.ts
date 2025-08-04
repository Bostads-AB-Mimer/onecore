import soapRequest from 'easy-soap-request'
import { format } from '../../../helpers/personnummer'
import { getCreditInformation } from '../adapters/creditsafe-adapter'

jest.mock('easy-soap-request')
jest.mock('dedent')
jest.mock('../../../helpers/personnummer')

const formattedPnr = '4512121122'
const originalPnr = '194512121122'

beforeEach(() => {
  jest.resetAllMocks()
  ;(format as jest.Mock).mockReturnValue(formattedPnr)
})

describe('getCreditInformation', () => {
  it('should fetch credit information successfully when consumer approved', async () => {
    const CASResponse = {
      response: {
        body: `
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <CasPersonServiceResponse xmlns="https://webservice.creditsafe.se/CAS/">
                <CasPersonServiceResult>
                  <TemplateNames>TEST_TEMPLATE</TemplateNames>
                  <Status>1</Status>
                  <Status_Text>Godkänd</Status_Text>
                  <ErrorList></ErrorList>
                  <FirstName>Erik</FirstName>
                  <LastName>Lundberg</LastName>
                  <Address>Gatvägen 56</Address>
                  <ZIP>72266</ZIP>
                  <Town>Västerås</Town>
                </CasPersonServiceResult>
              </CasPersonServiceResponse>
            </soap:Body>
          </soap:Envelope>
        `,
      },
    }
    ;(soapRequest as jest.Mock).mockResolvedValueOnce(CASResponse)

    const data = await getCreditInformation(originalPnr)

    expect(soapRequest).toHaveBeenCalledTimes(1)
    expect(format).toHaveBeenCalledWith(originalPnr)
    expect(data).toEqual({
      pnr: formattedPnr,
      template: 'TEST_TEMPLATE',
      status: '1',
      status_text: 'Godkänd',
      errorList: [],
      name: 'Erik Lundberg',
      address: 'Gatvägen 56',
      zip: '72266',
      city: 'Västerås',
    })
  })

  it('should fetch credit information successfully when consumer not approved', async () => {
    const CASResponse = {
      response: {
        body: `
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <CasPersonServiceResponse xmlns="https://webservice.creditsafe.se/CAS/">
                <CasPersonServiceResult>
                  <TemplateNames>TEST_TEMPLATE</TemplateNames>
                  <Status>2</Status>
                  <Status_Text>Ej Godkänd</Status_Text>
                  <ErrorList>
                    <ERROR>
                      <Cause_of_Reject>P24</Cause_of_Reject>
                      <Reject_text>Scoring</Reject_text>
                      <Reject_comment></Reject_comment>
                    </ERROR>
                  </ErrorList>
                  <FirstName>Erik</FirstName>
                  <LastName>Lundberg</LastName>
                  <Address>Gatvägen 56</Address>
                  <ZIP>72266</ZIP>
                  <Town>Västerås</Town>
                </CasPersonServiceResult>
              </CasPersonServiceResponse>
            </soap:Body>
          </soap:Envelope>
        `,
      },
    }
    ;(soapRequest as jest.Mock).mockResolvedValueOnce(CASResponse)

    const data = await getCreditInformation(originalPnr)

    expect(soapRequest).toHaveBeenCalledTimes(1)
    expect(format).toHaveBeenCalledWith(originalPnr)
    expect(data).toEqual({
      pnr: formattedPnr,
      template: 'TEST_TEMPLATE',
      status: '2',
      status_text: 'Ej Godkänd',
      errorList: [
        {
          Cause_of_Reject: 'P24',
          Reject_comment: '',
          Reject_text: 'Scoring',
        },
      ],
      name: 'Erik Lundberg',
      address: 'Gatvägen 56',
      zip: '72266',
      city: 'Västerås',
    })
  })

  it('should fetch credit information successfully when consumer not approved due to multiple errors', async () => {
    const CASResponse = {
      response: {
        body: `
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <CasPersonServiceResponse xmlns="https://webservice.creditsafe.se/CAS/">
                <CasPersonServiceResult>
                  <TemplateNames>TEST_TEMPLATE</TemplateNames>
                  <Status>2</Status>
                  <Status_Text>Ej Godkänd</Status_Text>
                  <ErrorList>
                    <ERROR>
                      <Cause_of_Reject>P24</Cause_of_Reject>
                      <Reject_text>Scoring</Reject_text>
                    </ERROR>
                    <ERROR>
                      <Cause_of_Reject>P10</Cause_of_Reject>
                      <Reject_text>Konkurs</Reject_text>
                    </ERROR>
                  </ErrorList>
                  <FirstName>Erik</FirstName>
                  <LastName>Lundberg</LastName>
                  <Address>Gatvägen 1</Address>
                  <ZIP>72266</ZIP>
                  <Town>Västerås</Town>
                </CasPersonServiceResult>
              </CasPersonServiceResponse>
            </soap:Body>
          </soap:Envelope>
        `,
      },
    }
    ;(soapRequest as jest.Mock).mockResolvedValueOnce(CASResponse)

    const data = await getCreditInformation(originalPnr)

    expect(soapRequest).toHaveBeenCalledTimes(1)
    expect(format).toHaveBeenCalledWith(originalPnr)
    expect(data).toEqual({
      pnr: formattedPnr,
      template: 'TEST_TEMPLATE',
      status: '2',
      status_text: 'Ej Godkänd',
      errorList: [
        {
          Cause_of_Reject: 'P24',
          Reject_text: 'Scoring',
        },
        {
          Cause_of_Reject: 'P10',
          Reject_text: 'Konkurs',
        },
      ],
      name: 'Erik Lundberg',
      address: 'Gatvägen 1',
      zip: '72266',
      city: 'Västerås',
    })
  })
})
