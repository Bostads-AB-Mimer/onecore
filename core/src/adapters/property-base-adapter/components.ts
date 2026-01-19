import { logger, loggedAxios as axios } from '@onecore/utilities'
import createClient from 'openapi-fetch'

import { AdapterResult } from '../types'
import { components, paths } from './generated/api-types'
import * as fileStorageAdapter from '../file-storage-adapter'
import config from '../../common/config'

const client = () =>
  createClient<paths>({
    baseUrl: config.propertyBaseService.url,
    headers: {
      'Content-Type': 'application/json',
    },
  })

type DocumentWithUrl = components['schemas']['DocumentWithUrl']

// ==================== COMPONENT CATEGORIES ====================

type GetComponentCategoriesResponse =
  components['schemas']['ComponentCategory'][]

async function getComponentCategories(
  page?: number,
  limit?: number
): Promise<AdapterResult<GetComponentCategoriesResponse, 'unknown'>> {
  try {
    const response = await client().GET('/component-categories' as any, {
      params: { query: { page, limit } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentCategories')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentCategoryResponse = components['schemas']['ComponentCategory']

async function getComponentCategoryById(
  id: string
): Promise<
  AdapterResult<GetComponentCategoryResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().GET('/component-categories/{id}' as any, {
      params: { path: { id } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentCategoryById')
    return { ok: false, err: 'unknown' }
  }
}

async function createComponentCategory(
  data: components['schemas']['CreateComponentCategoryRequest']
): Promise<AdapterResult<GetComponentCategoryResponse, 'unknown'>> {
  try {
    const response = await client().POST('/component-categories', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponentCategory')
    return { ok: false, err: 'unknown' }
  }
}

async function updateComponentCategory(
  id: string,
  data: components['schemas']['UpdateComponentCategoryRequest']
): Promise<
  AdapterResult<GetComponentCategoryResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().PUT('/component-categories/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponentCategory')
    return { ok: false, err: 'unknown' }
  }
}

async function deleteComponentCategory(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/component-categories/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponentCategory')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT TYPES ====================

type GetComponentTypesResponse = components['schemas']['ComponentType'][]

async function getComponentTypes(
  categoryId?: string,
  page?: number,
  limit?: number
): Promise<AdapterResult<GetComponentTypesResponse, 'unknown'>> {
  try {
    const response = await client().GET('/component-types' as any, {
      params: { query: { categoryId, page, limit } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentTypes')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentTypeResponse = components['schemas']['ComponentType']

async function getComponentTypeById(
  id: string
): Promise<AdapterResult<GetComponentTypeResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().GET('/component-types/{id}' as any, {
      params: { path: { id } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentTypeById')
    return { ok: false, err: 'unknown' }
  }
}

async function createComponentType(
  data: components['schemas']['CreateComponentTypeRequest']
): Promise<AdapterResult<GetComponentTypeResponse, 'unknown'>> {
  try {
    const response = await client().POST('/component-types', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponentType')
    return { ok: false, err: 'unknown' }
  }
}

async function updateComponentType(
  id: string,
  data: components['schemas']['UpdateComponentTypeRequest']
): Promise<AdapterResult<GetComponentTypeResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().PUT('/component-types/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponentType')
    return { ok: false, err: 'unknown' }
  }
}

async function deleteComponentType(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/component-types/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponentType')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT SUBTYPES ====================

type GetComponentSubtypesResponse = components['schemas']['ComponentSubtype'][]

async function getComponentSubtypes(
  typeId?: string,
  page?: number,
  limit?: number,
  subtypeName?: string
): Promise<AdapterResult<GetComponentSubtypesResponse, 'unknown'>> {
  try {
    const response = await client().GET('/component-subtypes' as any, {
      params: { query: { typeId, page, limit, subtypeName } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentSubtypes')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentSubtypeResponse = components['schemas']['ComponentSubtype']

async function getComponentSubtypeById(
  id: string
): Promise<
  AdapterResult<GetComponentSubtypeResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().GET('/component-subtypes/{id}' as any, {
      params: { path: { id } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentSubtypeById')
    return { ok: false, err: 'unknown' }
  }
}

async function createComponentSubtype(
  data: components['schemas']['CreateComponentSubtypeRequest']
): Promise<AdapterResult<GetComponentSubtypeResponse, 'unknown'>> {
  try {
    const response = await client().POST('/component-subtypes', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponentSubtype')
    return { ok: false, err: 'unknown' }
  }
}

async function updateComponentSubtype(
  id: string,
  data: components['schemas']['UpdateComponentSubtypeRequest']
): Promise<
  AdapterResult<GetComponentSubtypeResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().PUT('/component-subtypes/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponentSubtype')
    return { ok: false, err: 'unknown' }
  }
}

async function deleteComponentSubtype(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/component-subtypes/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponentSubtype')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT MODELS ====================

type GetComponentModelsResponse = components['schemas']['ComponentModel'][]

async function getComponentModels(
  componentTypeId?: string,
  subtypeId?: string,
  manufacturer?: string,
  page?: number,
  limit?: number,
  modelName?: string
): Promise<AdapterResult<GetComponentModelsResponse, 'unknown'>> {
  try {
    const response = await client().GET('/component-models' as any, {
      params: {
        query: {
          componentTypeId,
          subtypeId,
          manufacturer,
          page,
          limit,
          modelName,
        },
      },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentModels')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentModelResponse = components['schemas']['ComponentModel']

async function getComponentModelById(
  id: string
): Promise<AdapterResult<GetComponentModelResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().GET('/component-models/{id}' as any, {
      params: { path: { id } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentModelById')
    return { ok: false, err: 'unknown' }
  }
}

/**
 * Find a component model by exact model name match.
 * Used by the add-component process to check if a model already exists.
 */
async function findModelByExactName(
  modelName: string
): Promise<AdapterResult<GetComponentModelResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().GET(
      '/component-models/by-name/{modelName}' as any,
      {
        params: { path: { modelName } },
      }
    )

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.findModelByExactName')
    return { ok: false, err: 'unknown' }
  }
}

async function createComponentModel(
  data: components['schemas']['CreateComponentModelRequest']
): Promise<AdapterResult<GetComponentModelResponse, 'unknown'>> {
  try {
    const response = await client().POST('/component-models', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponentModel')
    return { ok: false, err: 'unknown' }
  }
}

async function updateComponentModel(
  id: string,
  data: components['schemas']['UpdateComponentModelRequest']
): Promise<AdapterResult<GetComponentModelResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().PUT('/component-models/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponentModel')
    return { ok: false, err: 'unknown' }
  }
}

async function deleteComponentModel(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/component-models/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponentModel')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENTS ====================

type GetComponentsResponse = components['schemas']['Component'][]

async function getComponents(
  modelId?: string,
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED',
  page?: number,
  limit?: number,
  serialNumber?: string
): Promise<AdapterResult<GetComponentsResponse, 'unknown'>> {
  try {
    const response = await client().GET('/components' as any, {
      params: { query: { modelId, status, page, limit, serialNumber } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponents')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentResponse = components['schemas']['Component']

async function getComponentById(
  id: string
): Promise<AdapterResult<GetComponentResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().GET('/components/{id}' as any, {
      params: { path: { id } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentById')
    return { ok: false, err: 'unknown' }
  }
}

async function createComponent(
  data: components['schemas']['CreateComponentRequest']
): Promise<AdapterResult<GetComponentResponse, 'unknown'>> {
  try {
    const response = await client().POST('/components', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    // Log error details from microservice response
    logger.error(
      {
        status: response.response?.status,
        error: (response.data as any)?.error,
        stack: (response.data as any)?.stack,
        requestData: data,
      },
      'property-base-adapter.createComponent failed'
    )

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error(
      { err, requestData: data },
      'property-base-adapter.createComponent exception'
    )
    return { ok: false, err: 'unknown' }
  }
}

async function updateComponent(
  id: string,
  data: components['schemas']['UpdateComponentRequest']
): Promise<AdapterResult<GetComponentResponse, 'unknown' | 'not_found'>> {
  try {
    const response = await client().PUT('/components/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponent')
    return { ok: false, err: 'unknown' }
  }
}

async function deleteComponent(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/components/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponent')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT INSTALLATIONS ====================

type GetComponentInstallationsResponse =
  components['schemas']['ComponentInstallation'][]

async function getComponentInstallations(
  componentId?: string,
  spaceId?: string,
  buildingPartId?: string,
  page?: number,
  limit?: number
): Promise<AdapterResult<GetComponentInstallationsResponse, 'unknown'>> {
  try {
    const response = await client().GET('/component-installations' as any, {
      params: { query: { componentId, spaceId, buildingPartId, page, limit } },
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentInstallations')
    return { ok: false, err: 'unknown' }
  }
}

type GetComponentInstallationResponse =
  components['schemas']['ComponentInstallation']

async function getComponentInstallationById(
  id: string
): Promise<
  AdapterResult<GetComponentInstallationResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().GET(
      '/component-installations/{id}' as any,
      {
        params: { path: { id } },
      }
    )

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentInstallationById')
    return { ok: false, err: 'unknown' }
  }
}

async function createComponentInstallation(
  data: components['schemas']['CreateComponentInstallationRequest']
): Promise<AdapterResult<GetComponentInstallationResponse, 'unknown'>> {
  try {
    const response = await client().POST('/component-installations', {
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.createComponentInstallation')
    return { ok: false, err: 'unknown' }
  }
}

async function updateComponentInstallation(
  id: string,
  data: components['schemas']['UpdateComponentInstallationRequest']
): Promise<
  AdapterResult<GetComponentInstallationResponse, 'unknown' | 'not_found'>
> {
  try {
    const response = await client().PUT('/component-installations/{id}', {
      params: { path: { id } },
      body: data as any,
    })

    if ((response.data as any)?.content) {
      return { ok: true, data: (response.data as any).content }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.updateComponentInstallation')
    return { ok: false, err: 'unknown' }
  }
}

async function deleteComponentInstallation(
  id: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    const response = await client().DELETE('/component-installations/{id}', {
      params: { path: { id } },
    })

    if (response.response.status === 204) {
      return { ok: true, data: undefined }
    }

    if (response.response.status === 404) {
      return { ok: false, err: 'not_found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.deleteComponentInstallation')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENTS BY ROOM ====================

type GetComponentsByRoomIdResponse = components['schemas']['Component'][]

async function getComponentsByRoomId(
  roomId: string
): Promise<
  AdapterResult<GetComponentsByRoomIdResponse, 'not-found' | 'unknown'>
> {
  try {
    const fetchResponse = await client().GET(
      '/components/by-room/{roomId}' as any,
      {
        params: { path: { roomId } },
      }
    )

    if ((fetchResponse.data as any)?.content) {
      return { ok: true, data: (fetchResponse.data as any).content }
    }

    if (fetchResponse.response.status === 404) {
      return { ok: false, err: 'not-found' }
    }

    return { ok: false, err: 'unknown' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.getComponentsByRoomId')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT FILE UPLOADS ====================

async function uploadComponentFile(
  componentId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  _caption?: string
): Promise<
  AdapterResult<DocumentWithUrl, 'unknown' | 'bad_request' | 'forbidden'>
> {
  try {
    // Step 1: Upload file to file-storage service
    // Use folder structure: component-instance/{componentId}/{fileName}
    // This matches the frontend ContextType.ComponentInstance = 'component-instance'
    const storageFileName = `component-instance/${componentId}/${fileName}`

    const uploadResult = await fileStorageAdapter.uploadFile(
      storageFileName,
      fileBuffer,
      mimeType
    )

    if (!uploadResult.ok) {
      return {
        ok: false,
        err: uploadResult.err === 'bad_request' ? 'bad_request' : 'unknown',
      }
    }

    const fileId = uploadResult.data.fileName

    // Step 2: Create document metadata in property service
    const documentResponse = await axios.post(
      `${config.propertyBaseService.url}/documents`,
      {
        fileId,
        componentInstanceId: componentId,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!documentResponse.data) {
      return { ok: false, err: 'unknown' }
    }

    // Step 3: Get presigned URL for the file
    const urlResult = await fileStorageAdapter.getFileUrl(fileId, 86400)

    // Return combined result
    const result: DocumentWithUrl = {
      id: documentResponse.data.id,
      fileId: documentResponse.data.fileId,
      originalName: fileName,
      mimeType: mimeType,
      size: fileBuffer.length,
      createdAt: documentResponse.data.createdAt,
      url: urlResult.ok ? urlResult.data.url : '',
    }

    return { ok: true, data: result }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 400) {
      return { ok: false, err: 'bad_request' }
    }
    if (axiosErr.response?.status === 403) {
      return { ok: false, err: 'forbidden' }
    }
    logger.error(
      { err, componentId },
      'property-base-adapter.uploadComponentFile'
    )
    return { ok: false, err: 'unknown' }
  }
}

async function getComponentFiles(
  componentId: string
): Promise<AdapterResult<DocumentWithUrl[], 'unknown' | 'not_found'>> {
  try {
    // Get document metadata from property service
    const response = await client().GET(
      '/documents/component-instances/{id}' as any,
      {
        params: {
          path: { id: componentId } as any,
        },
      }
    )

    if (!response.data) {
      return { ok: false, err: 'not_found' }
    }

    const documents = response.data as Array<{
      id: string
      fileId: string
      createdAt: string
    }>

    // Fetch presigned URLs and metadata for each document from file-storage
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        try {
          const [urlResult, metadataResult] = await Promise.all([
            fileStorageAdapter.getFileUrl(doc.fileId, 86400),
            fileStorageAdapter.getFileMetadata(doc.fileId),
          ])

          return {
            id: doc.id,
            fileId: doc.fileId,
            originalName:
              (metadataResult.ok &&
                metadataResult.data?.metaData?.['x-amz-meta-original-name']) ||
              doc.fileId,
            mimeType:
              (metadataResult.ok &&
                metadataResult.data?.metaData?.['content-type']) ||
              'application/octet-stream',
            size: (metadataResult.ok && metadataResult.data?.size) || 0,
            createdAt: doc.createdAt,
            url: urlResult.ok ? urlResult.data.url : '',
          } as DocumentWithUrl
        } catch {
          return {
            id: doc.id,
            fileId: doc.fileId,
            originalName: doc.fileId,
            mimeType: 'application/octet-stream',
            size: 0,
            createdAt: doc.createdAt,
            url: '',
          } as DocumentWithUrl
        }
      })
    )

    return { ok: true, data: documentsWithUrls }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error(
      { err, componentId },
      'property-base-adapter.getComponentFiles'
    )
    return { ok: false, err: 'unknown' }
  }
}

async function deleteComponentFile(
  documentId: string,
  fileId?: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    // Delete document metadata from property service
    await client().DELETE('/documents/{id}' as any, {
      params: {
        path: { id: documentId } as any,
      },
    })

    // Also delete file from file-storage if fileId provided
    if (fileId) {
      await fileStorageAdapter.deleteFile(fileId)
    }

    return { ok: true, data: undefined }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error(
      { err, documentId },
      'property-base-adapter.deleteComponentFile'
    )
    return { ok: false, err: 'unknown' }
  }
}

// ==================== COMPONENT MODEL DOCUMENTS ====================

async function uploadComponentModelDocument(
  modelId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<
  AdapterResult<DocumentWithUrl, 'unknown' | 'bad_request' | 'forbidden'>
> {
  try {
    // Step 1: Upload file to file-storage service
    // Use folder structure: ComponentModel/{modelId}/{fileName}
    // This matches the frontend pattern in useDocuments.ts
    const storageFileName = `ComponentModel/${modelId}/${fileName}`

    const uploadResult = await fileStorageAdapter.uploadFile(
      storageFileName,
      fileBuffer,
      mimeType
    )

    if (!uploadResult.ok) {
      return {
        ok: false,
        err: uploadResult.err === 'bad_request' ? 'bad_request' : 'unknown',
      }
    }

    const fileId = uploadResult.data.fileName

    // Step 2: Create document metadata in property service
    const documentResponse = await axios.post(
      `${config.propertyBaseService.url}/documents`,
      {
        fileId,
        componentModelId: modelId,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )

    if (!documentResponse.data) {
      return { ok: false, err: 'unknown' }
    }

    // Step 3: Get presigned URL for the file
    const urlResult = await fileStorageAdapter.getFileUrl(fileId, 86400)

    // Return combined result
    const result: DocumentWithUrl = {
      id: documentResponse.data.id,
      fileId: documentResponse.data.fileId,
      originalName: fileName,
      mimeType: mimeType,
      size: fileBuffer.length,
      createdAt: documentResponse.data.createdAt,
      url: urlResult.ok ? urlResult.data.url : '',
    }

    return { ok: true, data: result }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 400) {
      return { ok: false, err: 'bad_request' }
    }
    if (axiosErr.response?.status === 403) {
      return { ok: false, err: 'forbidden' }
    }
    logger.error(
      { err, modelId },
      'property-base-adapter.uploadComponentModelDocument'
    )
    return { ok: false, err: 'unknown' }
  }
}

async function getComponentModelDocuments(
  modelId: string
): Promise<AdapterResult<DocumentWithUrl[], 'unknown' | 'not_found'>> {
  try {
    // Get document metadata from property service
    const response = await client().GET(
      '/documents/component-models/{id}' as any,
      {
        params: {
          path: { id: modelId } as any,
        },
      }
    )

    if (!response.data) {
      return { ok: false, err: 'not_found' }
    }

    const documents = response.data as Array<{
      id: string
      fileId: string
      createdAt: string
    }>

    // Fetch presigned URLs and metadata for each document from file-storage
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        try {
          const [urlResult, metadataResult] = await Promise.all([
            fileStorageAdapter.getFileUrl(doc.fileId, 86400),
            fileStorageAdapter.getFileMetadata(doc.fileId),
          ])

          return {
            id: doc.id,
            fileId: doc.fileId,
            originalName:
              (metadataResult.ok &&
                metadataResult.data?.metaData?.['x-amz-meta-original-name']) ||
              doc.fileId,
            mimeType:
              (metadataResult.ok &&
                metadataResult.data?.metaData?.['content-type']) ||
              'application/octet-stream',
            size: (metadataResult.ok && metadataResult.data?.size) || 0,
            createdAt: doc.createdAt,
            url: urlResult.ok ? urlResult.data.url : '',
          } as DocumentWithUrl
        } catch {
          return {
            id: doc.id,
            fileId: doc.fileId,
            originalName: doc.fileId,
            mimeType: 'application/octet-stream',
            size: 0,
            createdAt: doc.createdAt,
            url: '',
          } as DocumentWithUrl
        }
      })
    )

    return { ok: true, data: documentsWithUrls }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error(
      { err, modelId },
      'property-base-adapter.getComponentModelDocuments'
    )
    return { ok: false, err: 'unknown' }
  }
}

async function deleteComponentModelDocument(
  documentId: string,
  fileId?: string
): Promise<AdapterResult<void, 'unknown' | 'not_found'>> {
  try {
    // Delete document metadata from property service
    await client().DELETE('/documents/{id}' as any, {
      params: {
        path: { id: documentId } as any,
      },
    })

    // Also delete file from file-storage if fileId provided
    if (fileId) {
      await fileStorageAdapter.deleteFile(fileId)
    }

    return { ok: true, data: undefined }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 404) {
      return { ok: false, err: 'not_found' }
    }
    logger.error(
      { err, documentId },
      'property-base-adapter.deleteComponentModelDocument'
    )
    return { ok: false, err: 'unknown' }
  }
}

// ==================== DOCUMENT METADATA ====================

async function createDocument(data: {
  fileId: string
  componentInstanceId?: string
  componentModelId?: string
}): Promise<
  AdapterResult<
    { id: string; fileId: string; createdAt: string },
    'bad_request' | 'unknown'
  >
> {
  try {
    const response = await axios.post(
      `${config.propertyBaseService.url}/documents`,
      data
    )
    return { ok: true, data: response.data }
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } }
    if (axiosErr.response?.status === 400) {
      return { ok: false, err: 'bad_request' }
    }
    logger.error({ err, data }, 'property-base-adapter.createDocument')
    return { ok: false, err: 'unknown' }
  }
}

// ==================== AI COMPONENT ANALYSIS ====================

async function analyzeComponentImage(
  data: components['schemas']['AnalyzeComponentImageRequest']
): Promise<
  AdapterResult<components['schemas']['AIComponentAnalysis'], string>
> {
  try {
    const response = await client().POST('/components/analyze-image', {
      body: data as any,
    })

    // Cast to access error properties - openapi-fetch types don't include error responses
    const res = response as {
      data?: { content?: components['schemas']['AIComponentAnalysis'] }
      error?: { error?: string }
      response: { status: number }
    }

    // openapi-fetch returns errors in response.error, not as exceptions
    if (res.error) {
      const errorMessage = res.error?.error ?? 'AI analysis failed'
      return {
        ok: false,
        err: errorMessage,
        statusCode: res.response.status,
      }
    }

    if (res.data?.content) {
      return {
        ok: true,
        data: res.data.content,
      }
    }

    return { ok: false, err: 'AI analysis failed' }
  } catch (err) {
    logger.error({ err }, 'property-base-adapter.analyzeComponentImage')
    return { ok: false, err: 'AI analysis failed' }
  }
}

export {
  // Component Categories
  getComponentCategories,
  getComponentCategoryById,
  createComponentCategory,
  updateComponentCategory,
  deleteComponentCategory,
  // Component Types
  getComponentTypes,
  getComponentTypeById,
  createComponentType,
  updateComponentType,
  deleteComponentType,
  // Component Subtypes
  getComponentSubtypes,
  getComponentSubtypeById,
  createComponentSubtype,
  updateComponentSubtype,
  deleteComponentSubtype,
  // Component Models
  getComponentModels,
  getComponentModelById,
  findModelByExactName,
  createComponentModel,
  updateComponentModel,
  deleteComponentModel,
  // Components
  getComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  // Component Installations
  getComponentInstallations,
  getComponentInstallationById,
  createComponentInstallation,
  updateComponentInstallation,
  deleteComponentInstallation,
  // Components by Room
  getComponentsByRoomId,
  // Component File Uploads
  uploadComponentFile,
  getComponentFiles,
  deleteComponentFile,
  // Component Model Documents
  uploadComponentModelDocument,
  getComponentModelDocuments,
  deleteComponentModelDocument,
  // Document Metadata
  createDocument,
  // AI Analysis
  analyzeComponentImage,
}
