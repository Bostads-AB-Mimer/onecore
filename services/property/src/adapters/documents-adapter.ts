import { prisma } from './db'

export const createDocument = async (data: {
  componentModelId?: string
  componentInstanceId?: string
  fileId: string
}) => {
  if (!data.componentModelId && !data.componentInstanceId) {
    throw new Error(
      'Either componentModelId or componentInstanceId must be provided'
    )
  }
  if (data.componentModelId && data.componentInstanceId) {
    throw new Error(
      'Cannot provide both componentModelId and componentInstanceId'
    )
  }

  return prisma.documents.create({ data })
}

export const getDocumentById = async (id: string) => {
  return prisma.documents.findUnique({ where: { id } })
}

export const getDocumentsByComponentModel = async (
  componentModelId: string
) => {
  return prisma.documents.findMany({
    where: { componentModelId },
    orderBy: { createdAt: 'desc' },
  })
}

export const getDocumentsByComponent = async (componentInstanceId: string) => {
  return prisma.documents.findMany({
    where: { componentInstanceId },
    orderBy: { createdAt: 'desc' },
  })
}

export const deleteDocument = async (id: string) => {
  const document = await getDocumentById(id)
  if (!document) {
    throw new Error('Document not found')
  }

  // Note: File deletion from storage should be handled by the frontend via file-storage service
  await prisma.documents.delete({ where: { id } })
}
