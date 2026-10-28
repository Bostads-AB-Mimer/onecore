import { describe, expect, it } from 'vitest'

import type { GuideCategory } from '@/entities/guide'

import {
  chooseSubcategory,
  NEW_CATEGORY,
  NO_SUBCATEGORY,
  splitCategory,
} from './categorySelection'

const categories: GuideCategory[] = [
  { id: 'c1', name: 'Tenfast', parentId: null, createdAt: '', updatedAt: '' },
  { id: 'c3', name: 'Avtal', parentId: 'c1', createdAt: '', updatedAt: '' },
]

describe('splitCategory', () => {
  it('leaves both selects empty without a category', () => {
    expect(splitCategory(null, categories)).toEqual({
      category: '',
      subcategory: NO_SUBCATEGORY,
    })
  })

  it('selects a top-level category without a subcategory', () => {
    expect(splitCategory({ id: 'c1' }, categories)).toEqual({
      category: 'c1',
      subcategory: NO_SUBCATEGORY,
    })
  })

  it('selects the parent and the subcategory of a saved guide', () => {
    expect(splitCategory({ id: 'c3' }, categories)).toEqual({
      category: 'c1',
      subcategory: 'c3',
    })
  })

  it('shows the name fields for a new category or subcategory', () => {
    expect(splitCategory({ name: 'Nytt' }, categories)).toEqual({
      category: NEW_CATEGORY,
      subcategory: NO_SUBCATEGORY,
    })
    expect(splitCategory({ name: 'Nytt', parentId: 'c1' }, categories)).toEqual(
      { category: 'c1', subcategory: NEW_CATEGORY }
    )
  })
})

describe('chooseSubcategory', () => {
  it('maps each choice to the category the guide is saved in', () => {
    expect(chooseSubcategory('c1', NO_SUBCATEGORY)).toEqual({ id: 'c1' })
    expect(chooseSubcategory('c1', NEW_CATEGORY)).toEqual({
      name: '',
      parentId: 'c1',
    })
    expect(chooseSubcategory('c1', 'c3')).toEqual({ id: 'c3' })
  })
})
