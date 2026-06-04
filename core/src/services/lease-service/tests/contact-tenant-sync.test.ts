import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { Contact, Lease } from '../schemas/lease'

/**
 * Guards "all tenants are contacts" for schemas/lease.ts: a tenant carries every
 * Contact field (may add/narrow, never drop/loosen). The compile-time assertion is
 * authoritative; the runtime test documents intent and keeps the suite non-empty.
 */
type ContactType = z.infer<typeof Contact>
type TenantType = NonNullable<z.infer<typeof Lease>['tenants']>[number]

// Fails tsc if a tenant stops being assignable to a Contact — fix lease.ts, not this.
const _assertTenantIsContact = (tenant: TenantType): ContactType => tenant
void _assertTenantIsContact

describe('Contact / tenant schema sync', () => {
  const contactJson = zodToJsonSchema(Contact, { target: 'openApi3' }) as {
    properties: Record<string, unknown>
  }
  const leaseJson = zodToJsonSchema(Lease, { target: 'openApi3' }) as {
    properties: { tenants: { items: { properties: Record<string, unknown> } } }
  }
  const tenantProps = leaseJson.properties.tenants.items.properties

  it('carries every Contact field on a tenant (all tenants are contacts)', () => {
    for (const field of Object.keys(contactJson.properties)) {
      expect(tenantProps).toHaveProperty(field)
    }
  })
})
