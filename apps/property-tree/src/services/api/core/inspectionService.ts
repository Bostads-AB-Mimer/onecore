import { InspectionStatusFilter } from '@/shared/types/inspection'

import { ApiError, DELETE, GET, PATCH, POST } from './baseApi'
import { components } from './generated/api-types'

type InspectionWithSource = components['schemas']['InspectionWithSource']
type DetailedInspection = components['schemas']['DetailedInspection']
type InternalInspection = components['schemas']['InternalInspection']
type TenantContactsResponse = components['schemas']['TenantContactsResponse']
type SendProtocolRequest = components['schemas']['SendProtocolRequest']
type SendProtocolResponse = components['schemas']['SendProtocolResponse']
type CreateInspectionRequest = components['schemas']['CreateInspectionRequest']
type UpdateInspectionStatusRequest =
  components['schemas']['UpdateInspectionStatusRequest']
type SaveInspectionDraftRequest =
  components['schemas']['SaveInspectionDraftRequest']
type AddInspectionRoomRequest =
  components['schemas']['AddInspectionRoomRequest']
type Room = components['schemas']['Room']

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

    if (response.error) throw response.error
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
    if (response.error) throw response.error
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
    options?: { includeCosts?: boolean; source?: 'xpand' | 'internal' }
  ): Promise<string> {
    const path =
      options?.source === 'internal'
        ? '/inspections/internal/{inspectionId}/pdf'
        : '/inspections/xpand/{inspectionId}/pdf'
    const pdfResponse = await GET(path, {
      params: {
        path: { inspectionId },
        query: { includeCosts: options?.includeCosts ?? true },
      },
    })
    if (pdfResponse.error) throw pdfResponse.error
    if (!pdfResponse.data?.content?.pdfBase64)
      throw new Error('No PDF data returned from API')

    return pdfResponse.data.content.pdfBase64
  },

  async getTenantContacts(
    inspectionId: string,
    source: 'xpand' | 'internal' = 'xpand'
  ): Promise<TenantContactsResponse> {
    const path =
      source === 'internal'
        ? '/inspections/internal/{inspectionId}/tenant-contacts'
        : '/inspections/{inspectionId}/tenant-contacts'
    const response = await GET(path, {
      params: { path: { inspectionId } },
    })
    if (response.error) throw response.error
    if (!response.data?.content) throw new Error('No data returned from API')

    return response.data.content as TenantContactsResponse
  },

  async getInternalInspectionDetails(
    inspectionId: string
  ): Promise<DetailedInspection> {
    const response = await GET('/inspections/internal/{inspectionId}/details', {
      params: { path: { inspectionId } },
    })
    if (response.error) throw response.error
    if (!response.data?.content) throw new Error('No data returned from API')

    return response.data.content
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

  async updateInternalInspection(
    inspectionId: string,
    body: components['schemas']['UpdateInspectionStatusRequest']
  ): Promise<InternalInspection> {
    const response = await PATCH('/inspections/internal/{inspectionId}', {
      params: { path: { inspectionId } },
      body,
    })
    if (response.error) throw response.error
    if (!response.data.content?.inspection)
      throw new Error('Failed to update inspection')

    return response.data.content.inspection
  },

  async sendProtocol(
    inspectionId: string,
    recipient: 'new-tenant' | 'tenant',
    source: 'xpand' | 'internal' = 'xpand'
  ): Promise<SendProtocolResponse> {
    const path =
      source === 'internal'
        ? '/inspections/internal/{inspectionId}/send-protocol'
        : '/inspections/{inspectionId}/send-protocol'
    const response = await POST(path, {
      params: { path: { inspectionId } },
      body: { recipient } as SendProtocolRequest,
    })
    if (response.error) throw response.error
    if (!response.data?.content) throw new Error('No data returned from API')

    return response.data.content as SendProtocolResponse
  },

  async updateInspectionStatus(
    inspectionId: string,
    status: UpdateInspectionStatusRequest['status']
  ): Promise<{
    inspection: InternalInspection
    componentWriteBackErrors: components['schemas']['ComponentWriteBackError'][]
  }> {
    const response = await PATCH('/inspections/internal/{inspectionId}', {
      params: { path: { inspectionId } },
      body: { status },
    })
    if (response.error) throw response.error
    if (!response.data.content?.inspection)
      throw new Error('Failed to update inspection status')

    return {
      inspection: response.data.content.inspection,
      componentWriteBackErrors:
        response.data.content.componentWriteBackErrors ?? [],
    }
  },

  async getInternalInspectionById(
    inspectionId: string
  ): Promise<InternalInspection> {
    const response = await GET('/inspections/internal/{inspectionId}', {
      params: { path: { inspectionId } },
    })
    if (response.error) throw response.error
    if (!response.data?.content?.inspection)
      throw new Error('No data returned from API')

    return response.data.content.inspection
  },

  async saveInspectionDraft(
    inspectionId: string,
    body: SaveInspectionDraftRequest
  ): Promise<void> {
    const response = await PATCH('/inspections/internal/{inspectionId}/draft', {
      params: { path: { inspectionId } },
      body,
    })
    if (response.error) throw response.error
  },

  async addInspectionRoom(
    inspectionId: string,
    body: AddInspectionRoomRequest
  ): Promise<Room> {
    const response = await POST('/inspections/internal/{inspectionId}/rooms', {
      params: { path: { inspectionId } },
      body,
    })
    if (response.error) throw response.error
    const room = response.data?.content?.room
    if (!room) throw new Error('Failed to add inspection room')
    return room
  },

  async removeInspectionRoom(
    inspectionId: string,
    roomId: string
  ): Promise<void> {
    const response = await DELETE(
      '/inspections/internal/{inspectionId}/rooms/{roomId}',
      { params: { path: { inspectionId, roomId } } }
    )
    const status = response.response.status
    if (status === 204) return
    if (status === 404) {
      throw new ApiError(404, 'room-not-added-in-this-inspection')
    }
    if (status === 409) {
      throw new ApiError(409, 'room-has-components')
    }
    throw new ApiError(status, `Failed to remove room (status ${status})`)
  },
}
