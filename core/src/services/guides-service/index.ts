import KoaRouter from '@koa/router'
import { guides } from '@onecore/types'

import { registerSchema } from '../../utils/openapi'
import { routes as guideRoutes } from './guides'
import { routes as imageRoutes } from './images'

/**
 * @swagger
 * tags:
 *   - name: Guides
 *     description: Step-by-step user guides with images, stored in the communication service
 */
export const routes = (router: KoaRouter) => {
  registerSchema('GuideCategory', guides.GuideCategorySchema)
  registerSchema('GuideSummary', guides.GuideSummarySchema)
  registerSchema('GuideStepImageWithUrl', guides.GuideStepImageWithUrlSchema)
  registerSchema('GuideWithUrls', guides.GuideWithUrlsSchema)
  registerSchema('UnpublishedGuide', guides.UnpublishedGuideSchema)
  registerSchema('CreateGuideRequest', guides.CreateGuideRequestSchema)
  registerSchema('UpdateGuideRequest', guides.UpdateGuideRequestSchema)
  registerSchema(
    'GuideImageUploadRequest',
    guides.GuideImageUploadRequestSchema
  )

  guideRoutes(router)
  imageRoutes(router)
}
