import { SystemHealth } from '@onecore/utilities'
import makeApp from '@src/app'
import config from '@src/common/config'
import { makeAppContext } from '@src/context'
import { CoreClient, CoreRequest, CoreResult } from '@src/adapters/core-adapter'

export interface FakeCore extends CoreClient {
  calls: Array<{ accessToken: string; req: CoreRequest }>
  respondWith: (result: CoreResult) => void
}

export const makeFakeCore = (): FakeCore => {
  let next: CoreResult = { ok: true, statusCode: 200, data: {} }
  const calls: FakeCore['calls'] = []

  return {
    calls,
    respondWith: (result) => {
      next = result
    },
    request: async (accessToken, req) => {
      calls.push({ accessToken, req })
      return next
    },
    health: async (): Promise<SystemHealth> => ({
      name: 'core',
      status: 'active',
      timeStamp: new Date(),
    }),
  }
}

export const makeTestApp = () => {
  const coreClient = makeFakeCore()
  const app = makeApp(
    makeAppContext({ ...config, logging: { enabled: false } }, { coreClient })
  )
  return { app, coreClient }
}
