import { guides } from '@onecore/types'

// Row shapes as returned by knex/tedious. UNIQUEIDENTIFIER columns come back
// upper-cased, so ids are normalised to lower case in the mappers.

export type GuideCategoryRow = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type GuideRow = {
  id: string
  slug: string
  title: string
  description: string
  categoryId: string
  status: guides.GuideStatus
  publishedAt: Date | null
  createdBy: string
  updatedBy: string
  createdAt: Date
  updatedAt: Date
}

export type GuideStepRow = {
  id: string
  guideId: string
  sortOrder: number
  title: string
  body: string
  calloutType: guides.CalloutType | null
  calloutText: string | null
  createdAt: Date
  updatedAt: Date
}

export type GuideStepImageRow = {
  id: string
  stepId: string
  sortOrder: number
  storageKey: string
  filename: string
  contentType: string
  altText: string
  caption: string | null
  createdAt: Date
}

export const normalizeId = (id: string) => id.toLowerCase()

export const mapCategory = (row: GuideCategoryRow): guides.GuideCategory => ({
  id: normalizeId(row.id),
  name: row.name,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export const mapImage = (row: GuideStepImageRow): guides.GuideStepImage => ({
  id: normalizeId(row.id),
  stepId: normalizeId(row.stepId),
  sortOrder: row.sortOrder,
  storageKey: row.storageKey,
  filename: row.filename,
  contentType: row.contentType,
  altText: row.altText,
  caption: row.caption,
  createdAt: row.createdAt,
})

export const mapStep = (
  row: GuideStepRow,
  images: GuideStepImageRow[]
): guides.GuideStep => ({
  id: normalizeId(row.id),
  guideId: normalizeId(row.guideId),
  sortOrder: row.sortOrder,
  title: row.title,
  body: row.body,
  calloutType: row.calloutType,
  calloutText: row.calloutText,
  images: images
    .filter((image) => normalizeId(image.stepId) === normalizeId(row.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(mapImage),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export const mapSummary = (
  row: GuideRow,
  category: GuideCategoryRow,
  stepCount: number
): guides.GuideSummary => ({
  id: normalizeId(row.id),
  slug: row.slug,
  title: row.title,
  description: row.description,
  status: row.status,
  category: mapCategory(category),
  stepCount,
  createdBy: row.createdBy,
  updatedBy: row.updatedBy,
  publishedAt: row.publishedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export const mapGuide = (
  row: GuideRow,
  category: GuideCategoryRow,
  steps: GuideStepRow[],
  images: GuideStepImageRow[]
): guides.Guide => ({
  ...mapSummary(row, category, steps.length),
  steps: [...steps]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((step) => mapStep(step, images)),
})
