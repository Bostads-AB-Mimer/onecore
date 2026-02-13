import { GET, POST } from './baseApi'
import { components } from './generated/api-types'
import { InspectionStatusFilter } from '../../../features/inspections/constants/inspectionTypes'

type Inspection = components['schemas']['Inspection']
type DetailedInspection = components['schemas']['DetailedInspection']
type TenantContactsResponse = components['schemas']['TenantContactsResponse']
type SendProtocolRequest = components['schemas']['SendProtocolRequest']
type SendProtocolResponse = components['schemas']['SendProtocolResponse']

export interface PaginatedInspectionsResponse {
  content: Inspection[]
  _meta?: components['schemas']['PaginationMeta']
  _links?: components['schemas']['PaginationLinks'][]
}

export const inspectionService = {
  async getAllInspections(params?: {
    page?: number
    limit?: number
    statusFilter?: InspectionStatusFilter
    inspector?: string
    address?: string
  }): Promise<PaginatedInspectionsResponse> {
    const externalInspections = await GET('/inspections/xpand', {
      params: {
        query: {
          page: params?.page,
          limit: params?.limit ?? 25,
          statusFilter: params?.statusFilter,
          inspector: params?.inspector,
          address: params?.address,
        },
      },
    })

    if (externalInspections.error) throw externalInspections.error
    if (!externalInspections.data.content)
      throw new Error('No data returned from API')

    return {
      content: externalInspections.data.content.map((v) => ({
        _tag: 'external' as const,
        ...v,
      })),
      _meta: externalInspections.data
        ._meta as components['schemas']['PaginationMeta'],
      _links: externalInspections.data
        ._links as components['schemas']['PaginationLinks'][],
    }
  },

  async getInspectionsForResidence(
    residenceId: string,
    statusFilter?: InspectionStatusFilter
  ): Promise<Inspection[]> {
    const externalInspections = await GET(
      '/inspections/xpand/residence/{residenceId}',
      {
        params: {
          path: { residenceId },
          query: { statusFilter },
        },
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
