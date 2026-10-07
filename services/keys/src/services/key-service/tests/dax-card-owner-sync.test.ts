import type { CardOwner } from 'dax-client'
import { isRentalObjectOwnerName, toOwnerRows } from '../dax-card-owner-sync'
import * as cardsAdapter from '../adapters/cards-adapter'
import * as daxAdapter from '../adapters/dax-adapter'
import * as mirror from '../dax-card-owner-mirror'

const owner = (
  cardOwnerId: string,
  name: string,
  overrides: Partial<CardOwner> = {}
): CardOwner =>
  ({
    cardOwnerId,
    familyName: name,
    specificName: '',
    state: 'Active',
    cards: [],
    ...overrides,
  }) as CardOwner

const card = (cardId: string) => ({ cardId, createTime: '2024-01-01' })

beforeEach(jest.restoreAllMocks)

describe('isRentalObjectOwnerName', () => {
  it.each([
    ['806-007-09-0103', true],
    ['806-007-09-0103a', true],
    ['807-033-99-P23', true],
    ['104-012-01-210A', true],
    ['Bring Citymail', false],
    ['Blomkvist', false],
    ['', false],
  ])('%s -> %s', (name, expected) => {
    expect(isRentalObjectOwnerName(name)).toBe(expected)
  })
})

describe('toOwnerRows', () => {
  it('keeps active owners named by object, using specificName as fallback', () => {
    const rows = toOwnerRows([
      owner('1', '806-007-09-0103'),
      owner('2', '806-007-01-0401', { state: 'Archived' }),
      owner('3', '', { specificName: '806-007-01-0401' }),
      owner('4', 'AB Kone'),
    ])
    expect(rows).toEqual([
      { cardOwnerId: '1', name: '806-007-09-0103' },
      { cardOwnerId: '3', name: '806-007-01-0401' },
    ])
  })
})

describe('getCardsByRentalObjects', () => {
  afterEach(mirror.reset)

  it('fetches mirrored owners with idfilter and re-resolves suspects by name', async () => {
    mirror.replaceAll([
      { cardOwnerId: 'o1', name: '101-001-01-0001' },
      { cardOwnerId: 'o1a', name: '101-001-01-0001a' },
      { cardOwnerId: 'o2', name: '101-001-01-0002' },
      { cardOwnerId: 'o3', name: '101-001-01-0003' },
    ])
    const replaceSpy = jest.spyOn(mirror, 'replaceForRentalObject')
    const searchSpy = jest
      .spyOn(daxAdapter, 'searchCardOwners')
      .mockImplementation(async (params) => {
        if (params.idfilter) {
          // o2 missing, o3 archived -> both suspects
          return [
            owner('o1', '101-001-01-0001', { cards: [card('c1')] as never }),
            owner('o1a', '101-001-01-0001a', { cards: [card('c1a')] as never }),
            owner('o3', '101-001-01-0003', {
              state: 'Archived',
              cards: [card('old')] as never,
            }),
          ]
        }
        if (params.nameFilter === '101-001-01-0002') {
          return [
            owner('o2-new', '101-001-01-0002', {
              cards: [card('c2')] as never,
            }),
          ]
        }
        if (params.nameFilter === '101-001-01-0003') return []
        return []
      })

    const result = await cardsAdapter.getCardsByRentalObjects([
      '101-001-01-0001',
      '101-001-01-0002',
      '101-001-01-0003',
      '101-001-01-0004',
    ])

    expect(result['101-001-01-0001'].map((c) => c.cardId).sort()).toEqual([
      'c1',
      'c1a',
    ])
    expect(result['101-001-01-0002'].map((c) => c.cardId)).toEqual(['c2'])
    expect(result['101-001-01-0003']).toEqual([])
    // Not in the mirror: no tags, and no DAX lookup
    expect(result['101-001-01-0004']).toEqual([])
    expect(
      searchSpy.mock.calls.some(([p]) => p.nameFilter === '101-001-01-0004')
    ).toBe(false)

    const idCalls = searchSpy.mock.calls.filter(([p]) => p.idfilter)
    expect(idCalls).toHaveLength(1)
    expect(idCalls[0][0].idfilter!.split(',').sort()).toEqual([
      'o1',
      'o1a',
      'o2',
      'o3',
    ])

    const refreshed = replaceSpy.mock.calls.map(([code]) => code).sort()
    expect(refreshed).toEqual(['101-001-01-0002', '101-001-01-0003'])
    expect(replaceSpy).toHaveBeenCalledWith('101-001-01-0002', [
      { cardOwnerId: 'o2-new', name: '101-001-01-0002' },
    ])
  })
})

describe('dax-card-owner-mirror', () => {
  beforeEach(mirror.reset)

  it('throws until the first sync has completed', () => {
    expect(() => mirror.getOwnersForRentalObjects(['A'])).toThrow(
      mirror.MirrorNotReadyError
    )
  })

  it('matches by exact code or one trailing letter, per object', () => {
    mirror.replaceAll([
      { cardOwnerId: 'p', name: '806-007-09-0103' },
      { cardOwnerId: 'a', name: '806-007-09-0103a' },
      { cardOwnerId: 'x', name: '806-007-09-01030' },
      { cardOwnerId: 'q', name: '104-012-01-210A' },
    ])
    const m = mirror.getOwnersForRentalObjects([
      '806-007-09-0103',
      '104-012-01-210A',
      'ZZZ',
    ])
    expect(
      m.map((r) => `${r.rentalObjectCode}:${r.cardOwnerId}`).sort()
    ).toEqual(['104-012-01-210A:q', '806-007-09-0103:a', '806-007-09-0103:p'])
    mirror.replaceForRentalObject('806-007-09-0103', [
      { cardOwnerId: 'n', name: '806-007-09-0103' },
    ])
    expect(
      mirror
        .getOwnersForRentalObjects(['806-007-09-0103'])
        .map((r) => r.cardOwnerId)
    ).toEqual(['n'])
    expect(mirror.getState().count).toBe(3)
  })
})
