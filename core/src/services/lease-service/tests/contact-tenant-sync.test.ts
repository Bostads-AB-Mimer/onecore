import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { Contact, Lease } from '../schemas/lease'

/**
 * Guards the relationship between `Contact` and the inline `tenants` shape in
 * schemas/lease.ts: ALL TENANTS ARE CONTACTS. A tenant must carry every Contact
 * field (so it is usable anywhere a Contact is) but may ADD fields and may be
 * STRICTER (narrower) on shared ones — it just may never drop or loosen one. They
 * are kept as two inline copies because extending/referencing would make
 * zod-to-json-schema emit an unresolvable $ref for the shared `address`.
 *
 * The authoritative check is the compile-time assertion below: it fails `tsc` the
 * moment a tenant stops being assignable to a Contact. The runtime test just
 * documents the intent and keeps the suite non-empty.
 */
type ContactType = z.infer<typeof Contact>
type TenantType = NonNullable<z.infer<typeof Lease>['tenants']>[number]

// If this stops compiling, the tenant shape dropped or loosened a Contact field.
// Fix the schema in lease.ts, not this assertion.
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
