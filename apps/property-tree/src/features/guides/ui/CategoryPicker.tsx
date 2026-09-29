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

import type { EditorCategory } from '../lib/editorState'

// Sentinel option that reveals the "new category" field.
const NEW_CATEGORY = '__new__'

interface CategoryPickerProps {
  value: EditorCategory | null
  onChange: (category: EditorCategory | null) => void
}

/** Pick an existing category or type the name of a new one. */
export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const { data: categories, isLoading } = useGuideCategories()

  const selectValue =
    value === null ? '' : 'id' in value ? value.id : NEW_CATEGORY

  return (
    <div className="space-y-2">
      <Label htmlFor="guide-category">Kategori</Label>
      <Select
        value={selectValue}
        onValueChange={(next) =>
          onChange(next === NEW_CATEGORY ? { name: '' } : { id: next })
        }
        disabled={isLoading}
      >
        <SelectTrigger id="guide-category">
          <SelectValue
            placeholder={isLoading ? 'Laddar...' : 'Välj kategori...'}
          />
        </SelectTrigger>
        <SelectContent>
          {(categories ?? []).map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW_CATEGORY}>Skapa ny kategori...</SelectItem>
        </SelectContent>
      </Select>
      {value && 'name' in value && (
        <Input
          value={value.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Namn på ny kategori, t.ex. Tenfast"
          aria-label="Namn på ny kategori"
          maxLength={100}
          autoFocus
        />
      )}
    </div>
  )
}
