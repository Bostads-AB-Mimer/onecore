import { useGuideCategories } from '@/entities/guide'

import { Input } from '@/shared/ui/Input'
import { Label } from '@/shared/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/Select'

import {
  chooseSubcategory,
  NEW_CATEGORY,
  NO_SUBCATEGORY,
  splitCategory,
} from '../lib/categorySelection'
import type { EditorCategory } from '../lib/editorState'

interface CategoryPickerProps {
  value: EditorCategory | null
  onChange: (category: EditorCategory | null) => void
}

/**
 * Pick an existing category or type the name of a new one, then optionally
 * a subcategory of it. Subcategories can only be added under an existing
 * category, since a new one has no id to point at yet.
 */
export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const { data: categories, isLoading, isError } = useGuideCategories()
  const all = categories ?? []
  // Without the categories a saved subcategory cannot be told from a
  // top-level one, so picking anything would move the guide; keep the
  // select closed until they are there.
  const unavailable = isLoading || isError

  const { category: parentId, subcategory: subValue } = splitCategory(
    value,
    all
  )
  const topLevel = all.filter((category) => category.parentId === null)
  const subcategories = all.filter((category) => category.parentId === parentId)
  // Until the categories are there, a saved subcategory cannot be told from a
  // top-level category, so the subcategory select waits for them.
  const hasExistingParent =
    categories !== undefined && parentId !== '' && parentId !== NEW_CATEGORY

  return (
    <div className="space-y-2">
      <Label htmlFor="guide-category">Kategori</Label>
      <Select
        value={parentId}
        onValueChange={(next) =>
          onChange(next === NEW_CATEGORY ? { name: '' } : { id: next })
        }
        disabled={unavailable}
      >
        <SelectTrigger id="guide-category">
          <SelectValue
            placeholder={
              isLoading
                ? 'Laddar...'
                : isError
                  ? 'Kategorierna kunde inte hämtas'
                  : 'Välj kategori...'
            }
          />
        </SelectTrigger>
        <SelectContent>
          {topLevel.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW_CATEGORY}>Skapa ny kategori...</SelectItem>
        </SelectContent>
      </Select>
      {value && 'name' in value && !value.parentId && (
        <Input
          value={value.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Namn på ny kategori, t.ex. Tenfast"
          aria-label="Namn på ny kategori"
          maxLength={100}
          autoFocus
        />
      )}

      {hasExistingParent && (
        <>
          <Label htmlFor="guide-subcategory" className="block pt-2">
            Underkategori
          </Label>
          <Select
            value={subValue}
            onValueChange={(next) =>
              onChange(chooseSubcategory(parentId, next))
            }
          >
            <SelectTrigger id="guide-subcategory">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SUBCATEGORY}>
                Ingen underkategori
              </SelectItem>
              {subcategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_CATEGORY}>
                Skapa ny underkategori...
              </SelectItem>
            </SelectContent>
          </Select>
          {value && 'name' in value && value.parentId && (
            <Input
              value={value.name}
              onChange={(event) =>
                onChange({ name: event.target.value, parentId })
              }
              placeholder="Namn på ny underkategori, t.ex. Avtal"
              aria-label="Namn på ny underkategori"
              maxLength={100}
              autoFocus
            />
          )}
        </>
      )}
    </div>
  )
}
