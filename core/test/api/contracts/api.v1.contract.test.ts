import fs from 'fs'
import path from 'path'
import KoaRouter from '@koa/router'
import { makeOkapiRouter } from 'koa-okapi-router'

import { transformContact } from '@/api/v1/contacts/transform'
import { routes as attachContactsV1Routes } from '@/api/v1/contacts/index'
import { Config } from '@/common/config'

const enumerateCases = (dir: string) => {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
}

describe('Contracts', () => {
  describe('contacts v1', () => {
    describe('model transformation, internal => API shape', () => {
      const internalModelDir = path.join(__dirname, './internal/contacts')
      const v1ModelDir = path.join(__dirname, './v1/contacts')

      const CASES = enumerateCases(v1ModelDir)

      it.each(CASES)('should exactly match - %s', (fileName) => {
        // Given
        const internalModel = JSON.parse(
          fs.readFileSync(path.join(internalModelDir, fileName), 'utf8')
        )

        const apiModel = JSON.parse(
          fs.readFileSync(path.join(v1ModelDir, fileName), 'utf8')
        )

        // When
        const transformed = transformContact(internalModel)

        // Then
        expect(transformed).toEqual(apiModel)
      })
    })

    describe('routes', () => {
      const apiRouter = makeOkapiRouter(new KoaRouter(), {
        openapi: {
          info: { title: `ONECore API` },
        },
      })

      const config = {
        contactsService: {
          url: 'http://in-a-gadda-da-vida.honey/contacts',
        },
      }

      attachContactsV1Routes(apiRouter, config as Config)

      const canonicalOpenAPIJSON = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, 'v1/contacts.openapi.json'),
          'utf8'
        )
      )

      const generatedOpenAPIJSON = apiRouter.openapiJson()

      test('contacts/v1 API route schemas - MAY NOT CHANGE', () => {
        expect(generatedOpenAPIJSON).toEqual(canonicalOpenAPIJSON)
      })
    })
  })
})
