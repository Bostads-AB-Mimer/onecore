// Rental-object rows. The objects themselves come from the walk tree like
// every other level; the only thing added here is the tenant join, which is
// per property and cannot ride on the cached object payload.

import { memo } from 'react'

import { usePropertyTenants } from '../hooks/useOccupantData'
import type { CheckState, PropertyTreeNode } from '../model/selection'
import type { ObjectRowSpec } from '../model/treeRows'
import { ObjectRow } from './rows'

/** One object row, decorated with its current tenants (react-query dedupes
 * the per-property lookup). Memoised on scalar check/excluded state so a
 * checkbox click doesn't re-render every drawn row's query subscription. */
export const ObjectTenantRow = memo(function ObjectTenantRow({
  row,
  checkState,
  excluded,
  selectableObjects,
  onToggleObject,
}: {
  row: ObjectRowSpec
  checkState: CheckState
  excluded: boolean
  selectableObjects: boolean
  onToggleObject: (node: PropertyTreeNode) => void
}) {
  const tenants = usePropertyTenants(row.propertyDesignation)

  return (
    <ObjectRow
      depth={row.depth}
      object={row.object}
      tenants={
        tenants.data
          ? (tenants.data.tenantsByCode[row.object.code] ?? [])
          : undefined
      }
      checkState={checkState}
      selectable={selectableObjects}
      // Recipient semantics only where objects are not picked individually: a
      // vakant object reaches nobody, so it shows no inherited tick there.
      requiresTenants={!selectableObjects}
      onCheck={() => onToggleObject(row.node)}
      excluded={excluded}
    />
  )
})
