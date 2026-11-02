import { randomUUID } from 'crypto'
import { Factory } from 'fishery'
import { guides } from '@onecore/types'

/**
 * Test data factories for the guides module.
 *
 * factory.step.build()                      one step input
 * factory.guideWrite.build({ status: 'published' })
 */
export const StepFactory = Factory.define<guides.StepInput>(({ sequence }) => ({
  id: randomUUID(),
  title: `Step ${sequence}`,
  body: `<p>Body of step ${sequence}</p>`,
  calloutType: null,
  calloutText: null,
  images: [],
}))

export const GuideWriteFactory = Factory.define<guides.ServiceGuideWrite>(
  ({ sequence }) => ({
    title: `Guide ${sequence}`,
    description: `Description of guide ${sequence}`,
    // Unique per build so parallel builds inside one test do not collide.
    slug: `guide-${sequence}-${randomUUID().slice(0, 8)}`,
    category: { name: `Category ${sequence}` },
    status: 'draft',
    steps: StepFactory.buildList(2),
    author: 'Test User',
  })
)

export const step = StepFactory
export const guideWrite = GuideWriteFactory
