import { InspectionStatusFilter } from '@/shared/types/inspection'

import { GET, PATCH, POST } from './baseApi'
import { components } from './generated/api-types'

type InspectionWithSource = components['schemas']['InspectionWithSource']
type DetailedInspection = components['schemas']['DetailedInspection']
type TenantContactsResponse = components['schemas']['TenantContactsResponse']
type SendProtocolRequest = components['schemas']['SendProtocolRequest']
type SendProtocolResponse = components['schemas']['SendProtocolResponse']
type CreateInspectionRequest = components['schemas']['CreateInspectionRequest']
type UpdateInspectionStatusRequest =
  components['schemas']['UpdateInspectionStatusRequest']

export interface PaginatedInspectionsResponse {
  content: InspectionWithSource[]
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
    const response = await GET('/inspections', {
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

    if (!response.data?.content) throw new Error('No data returned from API')

    return {
      content: response.data.content,
      _meta: response.data._meta as components['schemas']['PaginationMeta'],
      _links: response.data
        ._links as components['schemas']['PaginationLinks'][],
    }
  },

  async getInspectionsForResidence(
    residenceId: string,
    statusFilter?: InspectionStatusFilter
  ): Promise<InspectionWithSource[]> {
    const response = await GET('/inspections/residence/{residenceId}', {
      params: {
        path: { residenceId },
        query: { statusFilter },
      },
    })
    if (!response.data?.content) throw new Error('No data returned from API')

    return response.data.content.inspections ?? []
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

  async getInspectionPdfBase64(
    inspectionId: string,
    options?: { includeCosts?: boolean }
  ): Promise<string> {
    const pdfResponse = await GET(
      '/inspections/xpand/{inspectionId}/pdf' as any,
      {
        params: {
          path: { inspectionId },
          query: { includeCosts: options?.includeCosts ?? true },
        },
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

  async createInspection(
    body: CreateInspectionRequest
  ): Promise<DetailedInspection> {
    const response = await POST('/inspections', { body })
    if (response.error) throw response.error
    if (!response.data.content?.inspection)
      throw new Error('Failed to create inspection')

    return response.data.content.inspection
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

  async updateInspectionStatus(
    inspectionId: string,
    status: UpdateInspectionStatusRequest['status']
  ): Promise<DetailedInspection> {
    const response = await PATCH('/inspections/internal/{inspectionId}', {
      params: { path: { inspectionId } },
      body: { status },
    })
    if (response.error) throw response.error
    if (!response.data.content?.inspection)
      throw new Error('Failed to update inspection status')

    return response.data.content.inspection
  },
}
