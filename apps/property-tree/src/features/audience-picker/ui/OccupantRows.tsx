// Display-only object rows below the tree levels: a trapphus' objects, a
// parkeringsområde's spaces, and the category groups (bilplatser/lokaler/
// övrigt), joined with current tenants per rental object.

import { Fragment } from 'react'

import {
  formatCodeRange,
  groupByCodePrefix,
} from '@/shared/lib/rentalObjectCode'

import type {
  OccupantTenant,
  RentalObjectSummary,
  RentalObjectType,
} from '../hooks/useOccupantData'
import {
  RENTAL_OBJECT_GROUP_LABELS,
  RENTAL_OBJECT_TYPE_LABELS,
  usePropertyRentalObjects,
  usePropertyTenants,
} from '../hooks/useOccupantData'
import type {
  BuildingExtrasSpec,
  NodeRowSpec,
  PropertyExtrasSpec,
} from '../model/districtRows'
import type {
  AudienceNode,
  AudienceObjectType,
  AudienceSelection,
} from '../model/selection'
import { nodeCheckState, objectTypeExcluded } from '../model/selection'
import { GroupRow, InfoRow, ObjectRow } from './rows'

const objectCode = (o: RentalObjectSummary) => o.rentalId

const residencesFirst = (a: RentalObjectSummary, b: RentalObjectSummary) =>
  (a.type === 'residence' ? 0 : 1) - (b.type === 'residence' ? 0 : 1) ||
  a.rentalId.localeCompare(b.rentalId, 'sv')

/** Inherited check-state for an object, exactly like any other child level:
 * the object's ancestors are its parent node's chain plus the parent. */
const objectCheckState = (
  selection: AudienceSelection,
  parentNode: AudienceNode,
  rentalId: string
) =>
  nodeCheckState(selection, {
    key: `object:${rentalId}`,
    ancestors: [...parentNode.ancestors, parentNode.key],
  })

const CATEGORIES: RentalObjectType[] = [
  'residence',
  'parkingSpace',
  'facility',
  'other',
]

/** Category groups (bilplatser/lokaler/övrigt) for a set of objects.
 *
 * `prefixGrouping` collapses long code runs into an expandable range row —
 * useful under a property, where objects from many buildings mix, but noise
 * under a single building whose code IS the shared prefix.
 * `allowFlatten` drops the category header when only one category is present
 * and there are no sibling rows it needs to be separated from. */
function CategoryGroupRows({
  objects,
  tenantsByCode,
  keyPrefix,
  parentNode,
  selection,
  activeTypes,
  depth,
  expanded,
  onToggleExpand,
  prefixGrouping = true,
  allowFlatten = false,
}: {
  objects: RentalObjectSummary[]
  tenantsByCode: Record<string, OccupantTenant[]> | undefined
  keyPrefix: string
  /** The node these objects hang under (building or property). */
  parentNode: AudienceNode
  selection: AudienceSelection
  activeTypes: ReadonlySet<AudienceObjectType>
  depth: number
  expanded: ReadonlySet<string>
  onToggleExpand: (key: string, currentlyExpanded: boolean) => void
  prefixGrouping?: boolean
  allowFlatten?: boolean
}) {
  const tenantsFor = (o: RentalObjectSummary) =>
    tenantsByCode ? (tenantsByCode[o.rentalId] ?? []) : undefined
  const present = CATEGORIES.filter((c) => objects.some((o) => o.type === c))
  const flat = allowFlatten && present.length === 1

  const objectRow = (
    o: RentalObjectSummary,
    rowDepth: number,
    excluded: boolean
  ) => (
    <ObjectRow
      key={o.rentalId}
      depth={rowDepth}
      object={o}
      tenants={tenantsFor(o)}
      checkState={objectCheckState(selection, parentNode, o.rentalId)}
      excluded={excluded}
    />
  )

  return (
    <>
      {present.map((category) => {
        const items = objects.filter((o) => o.type === category)
        const excluded = objectTypeExcluded(activeTypes, category)
        if (flat) {
          return (
            <Fragment key={category}>
              {items.map((o) => objectRow(o, depth, excluded))}
            </Fragment>
          )
        }
        const groupKey = `${keyPrefix}:${category}`
        const isExpanded = expanded.has(groupKey)
        return (
          <Fragment key={groupKey}>
            <GroupRow
              depth={depth}
              label={RENTAL_OBJECT_GROUP_LABELS[category]}
              count={items.length}
              expanded={isExpanded}
              onToggle={() => onToggleExpand(groupKey, isExpanded)}
              muted={excluded}
            />
            {isExpanded &&
              !prefixGrouping &&
              items.map((o) => objectRow(o, depth + 1, excluded))}
            {isExpanded &&
              prefixGrouping &&
              groupByCodePrefix(items, objectCode).map((group) => {
                if (group.items.length === 1) {
                  return objectRow(group.items[0], depth + 1, excluded)
                }
                const prefixKey = `${groupKey}:${group.prefix}`
                const prefixExpanded = expanded.has(prefixKey)
                return (
                  <Fragment key={prefixKey}>
                    <GroupRow
                      depth={depth + 1}
                      label={
                        group.items.find((o) => o.address)?.address ??
                        group.prefix
                      }
                      typeLabel={RENTAL_OBJECT_TYPE_LABELS[category]}
                      code={formatCodeRange(group, objectCode)}
                      count={group.items.length}
                      expanded={prefixExpanded}
                      onToggle={() => onToggleExpand(prefixKey, prefixExpanded)}
                      muted={excluded}
                    />
                    {prefixExpanded &&
                      group.items.map((o) =>
                        objectRow(o, depth + 2, excluded)
                      )}
                  </Fragment>
                )
              })}
          </Fragment>
        )
      })}
    </>
  )
}

/** Objects of one trapphus (its row itself comes from the tree builder). */
export function StaircaseOccupantRows({
  row,
  depth,
  selection,
  activeTypes,
}: {
  /** The staircase row spec (carries node + raw building/staircase codes). */
  row: NodeRowSpec
  depth: number
  selection: AudienceSelection
  activeTypes: ReadonlySet<AudienceObjectType>
}) {
  const structure = usePropertyRentalObjects(row.propertyCode)
  const tenants = usePropertyTenants(row.propertyDesignation)

  if (structure.isLoading) {
    return <InfoRow depth={depth} label="Laddar..." />
  }
  if (structure.error || !structure.data) {
    return <InfoRow depth={depth} label="Kunde inte hämta hyresobjekt" />
  }

  const tenantsByCode = tenants.data?.tenantsByCode
  const items = structure.data
    .filter(
      (o) =>
        o.buildingCode === row.buildingCode &&
        o.staircaseCode === row.staircaseCode
    )
    .sort(residencesFirst)

  return (
    <>
      {items.map((o) => (
        <ObjectRow
          key={o.rentalId}
          depth={depth}
          object={o}
          tenants={
            tenantsByCode ? (tenantsByCode[o.rentalId] ?? []) : undefined
          }
          checkState={objectCheckState(selection, row.node, o.rentalId)}
          excluded={objectTypeExcluded(activeTypes, o.type)}
        />
      ))}
    </>
  )
}

/** A building's staircase-less object groups (bilplatser/lokaler/övrigt). */
export function BuildingExtraRows({
  spec,
  selection,
  activeTypes,
  expanded,
  onToggleExpand,
}: {
  spec: BuildingExtrasSpec
  selection: AudienceSelection
  activeTypes: ReadonlySet<AudienceObjectType>
  expanded: ReadonlySet<string>
  onToggleExpand: (key: string, currentlyExpanded: boolean) => void
}) {
  const structure = usePropertyRentalObjects(spec.propertyCode)
  const tenants = usePropertyTenants(spec.propertyDesignation)

  const buildingCode = spec.buildingNode.value
  const objects = (structure.data ?? []).filter(
    (o) => o.buildingCode === buildingCode && o.staircaseCode === null
  )

  return (
    <>
      <CategoryGroupRows
        objects={objects}
        tenantsByCode={tenants.data?.tenantsByCode}
        keyPrefix={`grp:cat:${buildingCode}`}
        parentNode={spec.buildingNode}
        selection={selection}
        activeTypes={activeTypes}
        depth={spec.depth}
        expanded={expanded}
        onToggleExpand={onToggleExpand}
        // The building code is the objects' shared prefix, so a range row adds
        // nothing; without trapphus above them a lone category needs no header.
        prefixGrouping={false}
        allowFlatten={!spec.hasStaircases}
      />
      {tenants.data?.truncated && (
        <InfoRow
          depth={spec.depth}
          label="Alla hyresgäster kunde inte hämtas"
        />
      )}
    </>
  )
}

/** Spaces of one parkeringsområde, as display-only rows with tenants. */
export function ParkingAreaOccupantRows({
  parkingAreaNode,
  propertyCode,
  propertyDesignation,
  depth,
  selection,
  activeTypes,
}: {
  parkingAreaNode: AudienceNode
  propertyCode: string
  propertyDesignation: string
  depth: number
  selection: AudienceSelection
  activeTypes: ReadonlySet<AudienceObjectType>
}) {
  const structure = usePropertyRentalObjects(propertyCode)
  const tenants = usePropertyTenants(propertyDesignation)

  if (structure.isLoading) {
    return <InfoRow depth={depth} label="Laddar..." />
  }
  if (structure.error || !structure.data) {
    return <InfoRow depth={depth} label="Kunde inte hämta hyresobjekt" />
  }

  const tenantsByCode = tenants.data?.tenantsByCode
  const items = structure.data
    .filter((o) => o.parkingAreaCode === parkingAreaNode.value)
    .sort((a, b) => a.rentalId.localeCompare(b.rentalId, 'sv'))

  return (
    <>
      {items.map((o) => (
        <ObjectRow
          key={o.rentalId}
          depth={depth}
          object={o}
          tenants={
            tenantsByCode ? (tenantsByCode[o.rentalId] ?? []) : undefined
          }
          checkState={objectCheckState(selection, parkingAreaNode, o.rentalId)}
          excluded={objectTypeExcluded(activeTypes, o.type)}
        />
      ))}
      {tenants.data?.truncated && (
        <InfoRow depth={depth} label="Alla hyresgäster kunde inte hämtas" />
      )}
    </>
  )
}

/** Object groups attached directly to the property (no building/area). */
export function PropertyExtraRows({
  spec,
  selection,
  activeTypes,
  expanded,
  onToggleExpand,
}: {
  spec: PropertyExtrasSpec
  selection: AudienceSelection
  activeTypes: ReadonlySet<AudienceObjectType>
  expanded: ReadonlySet<string>
  onToggleExpand: (key: string, currentlyExpanded: boolean) => void
}) {
  const structure = usePropertyRentalObjects(spec.propertyCode)
  const tenants = usePropertyTenants(spec.propertyNode.value)
  const propertyObjects = (structure.data ?? []).filter(
    (o) => o.buildingCode === null && o.parkingAreaCode === null
  )
  if (propertyObjects.length === 0) return null

  return (
    <CategoryGroupRows
      objects={propertyObjects}
      tenantsByCode={tenants.data?.tenantsByCode}
      keyPrefix={`grp:cat:${spec.propertyNode.key}`}
      parentNode={spec.propertyNode}
      selection={selection}
      activeTypes={activeTypes}
      depth={spec.depth}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    />
  )
}
