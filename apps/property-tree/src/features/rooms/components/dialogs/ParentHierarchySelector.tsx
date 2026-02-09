import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Label } from '@/components/ui/v2/Label'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/v2/Collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/Select'
import { useComponentEntity } from '../../hooks/useComponentEntity'
import type { EntityType } from '@/services/types'

export interface HierarchyData {
  categoryId?: string
  typeId?: string
  subtypeId?: string
  modelId?: string
}

export type ParentEntityType = 'category' | 'type' | 'subtype' | 'model'

interface ParentHierarchySelectorProps {
  entityType: Exclude<EntityType, 'category'>
  initialHierarchy: HierarchyData
  onParentChange: (parentId: string | undefined) => void
}

// Map entity type to the parent ID field name used in the API
const parentIdFieldMap: Record<Exclude<EntityType, 'category'>, string> = {
  type: 'categoryId',
  subtype: 'typeId',
  model: 'componentSubtypeId',
  instance: 'modelId',
}

// Define which parent levels to show for each entity type
const parentLevelsMap: Record<
  Exclude<EntityType, 'category'>,
  ParentEntityType[]
> = {
  type: ['category'],
  subtype: ['category', 'type'],
  model: ['category', 'type', 'subtype'],
  instance: ['category', 'type', 'subtype', 'model'],
}

export function ParentHierarchySelector({
  entityType,
  initialHierarchy,
  onParentChange,
}: ParentHierarchySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >(initialHierarchy.categoryId)
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>(
    initialHierarchy.typeId
  )
  const [selectedSubtypeId, setSelectedSubtypeId] = useState<
    string | undefined
  >(initialHierarchy.subtypeId)
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
    initialHierarchy.modelId
  )

  const parentLevels = parentLevelsMap[entityType]

  // Fetch categories (always needed)
  const { data: categories, isLoading: categoriesLoading } =
    useComponentEntity('category')

  // Fetch types when category is selected
  const { data: types, isLoading: typesLoading } = useComponentEntity(
    'type',
    parentLevels.includes('type') && selectedCategoryId
      ? selectedCategoryId
      : ''
  )

  // Fetch subtypes when type is selected
  const { data: subtypes, isLoading: subtypesLoading } = useComponentEntity(
    'subtype',
    parentLevels.includes('subtype') && selectedTypeId ? selectedTypeId : ''
  )

  // Fetch models when subtype is selected
  const { data: models, isLoading: modelsLoading } = useComponentEntity(
    'model',
    parentLevels.includes('model') && selectedSubtypeId ? selectedSubtypeId : ''
  )

  // Get current selected entities for displaying info
  const selectedCategory = categories?.find((c) => c.id === selectedCategoryId)
  const selectedType = types?.find((t) => t.id === selectedTypeId)
  const selectedSubtype = subtypes?.find((s) => s.id === selectedSubtypeId)
  const selectedModel = models?.find((m) => m.id === selectedModelId)

  // Get the direct parent ID based on entity type
  const getDirectParentId = (): string | undefined => {
    switch (entityType) {
      case 'type':
        return selectedCategoryId
      case 'subtype':
        return selectedTypeId
      case 'model':
        return selectedSubtypeId
      case 'instance':
        return selectedModelId
      default:
        return undefined
    }
  }

  // Notify parent component when the direct parent changes
  useEffect(() => {
    const directParentId = getDirectParentId()
    onParentChange(directParentId)
  }, [selectedCategoryId, selectedTypeId, selectedSubtypeId, selectedModelId])

  // Handle category change - reset all child selections
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId)
    setSelectedTypeId(undefined)
    setSelectedSubtypeId(undefined)
    setSelectedModelId(undefined)
  }

  // Handle type change - reset subtype and model
  const handleTypeChange = (typeId: string) => {
    setSelectedTypeId(typeId)
    setSelectedSubtypeId(undefined)
    setSelectedModelId(undefined)
  }

  // Handle subtype change - reset model
  const handleSubtypeChange = (subtypeId: string) => {
    setSelectedSubtypeId(subtypeId)
    setSelectedModelId(undefined)
  }

  // Handle model change
  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId)
  }

  // Check if parent has changed from initial
  const hasParentChanged = (): boolean => {
    switch (entityType) {
      case 'type':
        return selectedCategoryId !== initialHierarchy.categoryId
      case 'subtype':
        return selectedTypeId !== initialHierarchy.typeId
      case 'model':
        return selectedSubtypeId !== initialHierarchy.subtypeId
      case 'instance':
        return selectedModelId !== initialHierarchy.modelId
      default:
        return false
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 text-sm font-medium text-left border rounded-md hover:bg-accent transition-colors">
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Ändra tillhörighet
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 p-4 border rounded-md space-y-4 bg-muted/30">
        {/* Category selector */}
        {parentLevels.includes('category') && (
          <div className="space-y-2">
            <Label htmlFor="category-select">Kategori</Label>
            <Select
              value={selectedCategoryId || ''}
              onValueChange={handleCategoryChange}
              disabled={categoriesLoading}
            >
              <SelectTrigger id="category-select">
                <SelectValue
                  placeholder={
                    categoriesLoading ? 'Laddar...' : 'Välj kategori'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.categoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory && (
              <p className="text-xs text-muted-foreground">
                {selectedCategory.description}
              </p>
            )}
          </div>
        )}

        {/* Type selector */}
        {parentLevels.includes('type') && (
          <div className="space-y-2">
            <Label htmlFor="type-select">Typ</Label>
            <Select
              value={selectedTypeId || ''}
              onValueChange={handleTypeChange}
              disabled={!selectedCategoryId || typesLoading}
            >
              <SelectTrigger id="type-select">
                <SelectValue
                  placeholder={
                    !selectedCategoryId
                      ? 'Välj kategori först'
                      : typesLoading
                        ? 'Laddar...'
                        : 'Välj typ'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {types?.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.typeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType?.description && (
              <p className="text-xs text-muted-foreground">
                {selectedType.description}
              </p>
            )}
          </div>
        )}

        {/* Subtype selector */}
        {parentLevels.includes('subtype') && (
          <div className="space-y-2">
            <Label htmlFor="subtype-select">Undertyp</Label>
            <Select
              value={selectedSubtypeId || ''}
              onValueChange={handleSubtypeChange}
              disabled={!selectedTypeId || subtypesLoading}
            >
              <SelectTrigger id="subtype-select">
                <SelectValue
                  placeholder={
                    !selectedTypeId
                      ? 'Välj typ först'
                      : subtypesLoading
                        ? 'Laddar...'
                        : 'Välj undertyp'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {subtypes?.map((subtype) => (
                  <SelectItem key={subtype.id} value={subtype.id}>
                    {subtype.subTypeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSubtype && (
              <p className="text-xs text-muted-foreground">
                Livslängd: {selectedSubtype.technicalLifespan} år | Avskrivning:{' '}
                {selectedSubtype.depreciationPrice} kr
              </p>
            )}
          </div>
        )}

        {/* Model selector */}
        {parentLevels.includes('model') && (
          <div className="space-y-2">
            <Label htmlFor="model-select">Modell</Label>
            <Select
              value={selectedModelId || ''}
              onValueChange={handleModelChange}
              disabled={!selectedSubtypeId || modelsLoading}
            >
              <SelectTrigger id="model-select">
                <SelectValue
                  placeholder={
                    !selectedSubtypeId
                      ? 'Välj undertyp först'
                      : modelsLoading
                        ? 'Laddar...'
                        : 'Välj modell'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {models?.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.manufacturer} - {model.modelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedModel && (
              <p className="text-xs text-muted-foreground">
                Pris: {selectedModel.currentPrice} kr | Garanti:{' '}
                {selectedModel.warrantyMonths} mån
              </p>
            )}
          </div>
        )}

        {/* Warning message when parent has changed */}
        {hasParentChanged() && (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            Obs: Alla underliggande objekt kommer att flyttas med!
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

export { parentIdFieldMap }
