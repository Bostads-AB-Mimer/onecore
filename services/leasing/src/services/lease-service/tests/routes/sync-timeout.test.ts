import KoaRouter from '@koa/router'
import { boundTenfastCalls } from '../../adapters/tenfast/tenfast-api'
import { routes as contactRoutes } from '../../routes/contacts'
import { routes as leaseSyncRoutes } from '../../routes/lease-sync'
import { routes as rentalObjectTypeSyncRoutes } from '../../routes/rental-object-type-sync'

const router = new KoaRouter()
contactRoutes(router)
leaseSyncRoutes(router)
rentalObjectTypeSyncRoutes(router)

const handlersFor = (method: string, path: string) =>
  router.stack
    .filter((layer) => layer.methods.includes(method))
    .filter((layer) => layer.match(path))
    .flatMap((layer) => layer.stack)

describe('Tenfast call bound on the sync routes', () => {
  it.each([
    ['POST', '/leases/sync'],
    ['POST', '/rental-objects/123-456/type/sync'],
    ['POST', '/contacts/P123456/sync'],
  ])('%s %s bounds its Tenfast calls', (method, path) => {
    expect(handlersFor(method, path)).toContain(boundTenfastCalls)
  })

  it('leaves other routes unbounded', () => {
    expect(handlersFor('GET', '/contacts/P123456')).not.toContain(
      boundTenfastCalls
    )
  })
})
