import {
  resolvePropertyShares,
  splitPropertyTreeNode,
} from '../../utils/property-shares'
import type { PropertyTreeNode } from '../../types/property-tree'

const A = 'area-a'
const B = 'area-b'

describe('resolvePropertyShares', () => {
  it('returns whole shares when there are no exceptions', () => {
    const shares = resolvePropertyShares(
      [{ id: A, propertyCodes: ['06601', '06602'] }],
      []
    )
    expect(shares.get(A)).toEqual([
      { propertyCode: '06601' },
      { propertyCode: '06602' },
    ])
  })

  it('splits a property between its default area and the exception area', () => {
    const shares = resolvePropertyShares(
      [
        { id: A, propertyCodes: ['06601'] },
        { id: B, propertyCodes: [] },
      ],
      [{ kvvAreaId: B, propertyCode: '06601', code: '307-048' }]
    )
    expect(shares.get(A)).toEqual([
      { propertyCode: '06601', buildings: { exclude: new Set(['307-048']) } },
    ])
    expect(shares.get(B)).toEqual([
      { propertyCode: '06601', buildings: { include: new Set(['307-048']) } },
    ])
  })

  it('gives an inbound share from a property linked outside the areas', () => {
    const shares = resolvePropertyShares(
      [{ id: B, propertyCodes: [] }],
      [{ kvvAreaId: B, propertyCode: '06601', code: '307-048' }]
    )
    expect(shares.get(B)).toEqual([
      { propertyCode: '06601', buildings: { include: new Set(['307-048']) } },
    ])
  })

  it('ignores a row pointing at the property default area', () => {
    const shares = resolvePropertyShares(
      [{ id: A, propertyCodes: ['06601'] }],
      [{ kvvAreaId: A, propertyCode: '06601', code: '307-048' }]
    )
    expect(shares.get(A)).toEqual([{ propertyCode: '06601' }])
  })

  it('orders inbound shares after linked ones, by property code', () => {
    const shares = resolvePropertyShares(
      [{ id: B, propertyCodes: ['09901'] }],
      [
        { kvvAreaId: B, propertyCode: '06602', code: 'x' },
        { kvvAreaId: B, propertyCode: '06601', code: 'y' },
      ]
    )
    expect(shares.get(B)?.map((s) => s.propertyCode)).toEqual([
      '09901',
      '06601',
      '06602',
    ])
  })
})

describe('splitPropertyTreeNode', () => {
  const leaf = (
    code: string
  ): NonNullable<PropertyTreeNode['children']>[number] =>
    ({
      type: 'residence',
      code,
      name: null,
      subtypeCode: null,
      subtypeName: null,
    }) as NonNullable<PropertyTreeNode['children']>[number]

  const node: PropertyTreeNode = {
    type: 'property',
    code: '06601',
    name: 'ALLMOGEKULTUREN 7',
    subtypeCode: null,
    subtypeName: null,
    children: [
      {
        type: 'building',
        code: '307-046',
        name: null,
        subtypeCode: null,
        subtypeName: null,
        children: [],
      },
      {
        type: 'building',
        code: '307-048',
        name: null,
        subtypeCode: null,
        subtypeName: null,
        children: [],
      },
      {
        type: 'parkingArea',
        code: '307-700-00',
        name: null,
        subtypeCode: null,
        subtypeName: null,
        children: [],
      },
      leaf('loose-1'),
    ],
  }

  it('keeps only the included buildings on the include side', () => {
    const out = splitPropertyTreeNode(node, { include: new Set(['307-048']) })
    expect(out.partial).toBe(true)
    expect(out.children?.map((c) => c.code)).toEqual(['307-048'])
  })

  it('keeps parking areas and loose objects on the exclude side', () => {
    const out = splitPropertyTreeNode(node, { exclude: new Set(['307-048']) })
    expect(out.partial).toBe(true)
    expect(out.children?.map((c) => c.code)).toEqual([
      '307-046',
      '307-700-00',
      'loose-1',
    ])
  })

  it('returns the node untouched for a whole share', () => {
    expect(splitPropertyTreeNode(node, undefined)).toBe(node)
    expect(splitPropertyTreeNode(node, { exclude: new Set() })).toBe(node)
  })
})
