import { prisma } from './db'
import { deleteFile, getFileMetadataFromMinio } from './minio-adapter'

export const createDocument = async (data: {
  componentModelId?: string
  componentInstanceId?: string
  fileId: string
}) => {
  if (!data.componentModelId && !data.componentInstanceId) {
    throw new Error('Either componentModelId or componentInstanceId must be provided')
  }
  if (data.componentModelId && data.componentInstanceId) {
    throw new Error('Cannot provide both componentModelId and componentInstanceId')
  }

  return prisma.documents.create({ data })
}

export const getDocumentById = async (id: string) => {
  return prisma.documents.findUnique({ where: { id } })
}

export const getDocumentsByComponentModel = async (componentModelId: string) => {
  return prisma.documents.findMany({
    where: { componentModelId },
    orderBy: { createdAt: 'desc' }
  })
}

export const getDocumentsByComponentInstance = async (componentInstanceId: string) => {
  return prisma.documents.findMany({
    where: { componentInstanceId },
    orderBy: { createdAt: 'desc' }
  })
}

export const deleteDocument = async (id: string) => {
  const document = await getDocumentById(id)
  if (!document) {
    throw new Error('Document not found')
  }

  await deleteFile(document.fileId)
  await prisma.documents.delete({ where: { id } })
}

export const getDocumentsWithMetadata = async (documents: Array<{ id: string; fileId: string; createdAt: Date }>) => {
  return Promise.all(
    documents.map(async (doc) => {
      const metadata = await getFileMetadataFromMinio(doc.fileId)
      return {
        id: doc.id,
        fileId: doc.fileId,
        originalName: metadata.originalName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        createdAt: doc.createdAt
      }
    })
  )
}
