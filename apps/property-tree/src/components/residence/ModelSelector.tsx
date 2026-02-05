import { useState, useMemo } from 'react'
import { Label } from '@/components/ui/v2/Label'
import { Input } from '@/components/ui/Input'
import { useComponentEntity } from '@/components/hooks/useComponentEntity'
import { useDebounce } from '@/components/hooks/useDebounce'
import type {
  ComponentModel,
  ComponentSubtype,
  ComponentType,
  ComponentCategory,
} from '@/services/types'

// Extended model type with full hierarchy
export type ComponentModelWithHierarchy = ComponentModel & {
  subtype?: ComponentSubtype & {
    componentType?: ComponentType & {
      category?: ComponentCategory
    }
  }
}

interface ModelSelectorProps {
  value: string
  onChange: (
    modelId: string,
    model: ComponentModelWithHierarchy | undefined
  ) => void
  error?: string
}

export const ModelSelector = ({
  value,
  onChange,
  error,
}: ModelSelectorProps) => {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  // Only search when user has typed at least 2 characters
  const shouldSearch = debouncedSearch.trim().length >= 2

  // Use backend search via useComponentEntity
  const {
    data: models,
    isLoading,
    error: modelsError,
  } = useComponentEntity(
    'model',
    '', // Empty parentId to search across all models
    { search: shouldSearch ? debouncedSearch : undefined }
  )

  // Backend returns models with full hierarchy already included
  const modelsWithHierarchy: ComponentModelWithHierarchy[] = (models ||
    []) as ComponentModelWithHierarchy[]

  // Build display options - no filtering needed, backend handles it
  const modelOptions = useMemo(() => {
    return modelsWithHierarchy.map((model) => {
      const categoryName =
        model.subtype?.componentType?.category?.categoryName || ''
      const typeName = model.subtype?.componentType?.typeName || ''
      const subtypeName = model.subtype?.subTypeName || ''

      return {
        model,
        displayName: `${categoryName} / ${typeName} / ${subtypeName} - ${model.manufacturer} ${model.modelName}`,
      }
    })
  }, [modelsWithHierarchy])

  const selectedModel = modelOptions.find((option) => option.model.id === value)

  const hasError = modelsError

  if (hasError) {
    return (
      <div>
        <Label>Modell</Label>
        <p className="text-sm text-destructive mt-1">
          Kunde inte ladda modeller
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="model-search">Modell</Label>
      <Input
        id="model-search"
        type="text"
        placeholder="Sök efter modell, tillverkare, typ..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-2"
      />

      <div className="border rounded-md max-h-60 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ) : !shouldSearch && search.length > 0 && search.length < 2 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Skriv minst 2 tecken för att söka
          </div>
        ) : !shouldSearch ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Sök efter modell, tillverkare eller typ
          </div>
        ) : modelOptions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Inga modeller hittades
          </div>
        ) : (
          <div className="divide-y">
            {modelOptions.map((option) => (
              <button
                key={option.model.id}
                type="button"
                onClick={() => {
                  onChange(option.model.id, option.model)
                  setSearch('')
                }}
                className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors ${
                  value === option.model.id ? 'bg-accent' : ''
                }`}
              >
                <div className="text-sm font-medium">
                  {option.model.manufacturer} {option.model.modelName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {option.displayName.split(' - ')[0]}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedModel && (
        <div className="mt-2 p-3 bg-accent rounded-md">
          <p className="text-sm font-medium">Vald modell:</p>
          <p className="text-sm text-muted-foreground">
            {selectedModel.displayName}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  )
}
