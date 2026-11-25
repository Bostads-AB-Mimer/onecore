import { Factory } from 'fishery'
import { TenfastArticle } from '../../adapters/tenfast/schemas'

export const TenfastArticleFactory = Factory.define<TenfastArticle>(
  ({ sequence }) => ({
    _id: `article-${sequence}`,
    code: `ART${sequence}`,
    vat: 0,
  })
)
