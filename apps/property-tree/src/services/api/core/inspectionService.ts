import { GET, POST } from './baseApi'
import { components } from './generated/api-types'

type Inspection = components['schemas']['Inspection']
type DetailedInspection = components['schemas']['DetailedInspection']
type TenantContactsResponse = components['schemas']['TenantContactsResponse']
type SendProtocolRequest = components['schemas']['SendProtocolRequest']
type SendProtocolResponse = components['schemas']['SendProtocolResponse']
// export type InternalInspection = {
//   _tag: 'internal'
// } & components['schemas']['Inspection']
// export type ExternalInspection = {
//   _tag: 'external'
// } & components['schemas']['XpandInspection']
// // export type Inspection = InternalInspection | ExternalInspection
// export type Inspection = ExternalInspection

export const inspectionService = {
  async getAllInspections(): Promise<Inspection[]> {
    const externalInspections = await GET('/inspections/xpand', {
      params: { query: { skip: 0, limit: 25 } },
    })

    if (externalInspections.error) throw externalInspections.error
    if (!externalInspections.data.content)
      throw new Error('No data returned from API')

    return (externalInspections.data.content.inspections ?? []).map((v) => ({
      _tag: 'external' as const,
      ...v,
    }))
  },

  async getInspectionsForResidence(residenceId: string): Promise<Inspection[]> {
    const externalInspections = await GET(
      '/inspections/xpand/residence/{residenceId}',
      {
        params: { path: { residenceId } },
      }
    )
    if (externalInspections.error) throw externalInspections.error
    if (!externalInspections.data.content)
      throw new Error('No data returned from API')

    return (externalInspections.data.content.inspections ?? []).map((v) => ({
      _tag: 'external' as const,
      ...v,
    }))
  },

  async getInspectionById(inspectionId: string): Promise<DetailedInspection> {
    const inspectionResponse = await GET('/inspections/xpand/{inspectionId}', {
      params: { path: { inspectionId } },
    })
    if (inspectionResponse.error) throw inspectionResponse.error
    if (!inspectionResponse.data.content)
      throw new Error('No data returned from API')

    return inspectionResponse.data.content
  },

  async getInspectionPdfBase64(inspectionId: string): Promise<string> {
    const pdfResponse = await GET(
      '/inspections/xpand/{inspectionId}/pdf' as any,
      {
        params: { path: { inspectionId } },
      }
    )
    if (pdfResponse.error) throw pdfResponse.error
    if (!(pdfResponse.data as any).content?.pdfBase64)
      throw new Error('No PDF data returned from API')

    return (pdfResponse.data as any).content.pdfBase64
  },

  async getTenantContacts(
    inspectionId: string
  ): Promise<TenantContactsResponse> {
    const response = await GET('/inspections/{inspectionId}/tenant-contacts', {
      params: { path: { inspectionId } },
    })
    if (response.error) throw response.error
    if (!response.data.content) throw new Error('No data returned from API')

    return response.data.content as TenantContactsResponse
  },

  async sendProtocol(
    inspectionId: string,
    recipient: 'new-tenant' | 'tenant'
  ): Promise<SendProtocolResponse> {
    const response = await POST('/inspections/{inspectionId}/send-protocol', {
      params: { path: { inspectionId } },
      body: { recipient } as SendProtocolRequest,
    })
    if (response.error) throw response.error
    if (!response.data.content) throw new Error('No data returned from API')

    return response.data.content as SendProtocolResponse
  },
}
