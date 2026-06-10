import { BASE_INSTRUCTIONS } from './base'
import { OUTPUT_FORMAT } from './output-format'
import { vitvarorPrompt } from './vitvaror'
import { generalPrompt } from './general'

// Category-specific domain overlays, keyed by the normalised (trimmed,
// lowercased) component_categories.categoryName from the component library.
// Each overlay only frames the domain (expert role + focus list); the shared
// analysis instructions and output contract are added by the resolver.
// Add a new category by creating an overlay file and registering it here; any
// category without an entry falls back to the general overlay.
const OVERLAYS: Record<string, string> = {
  vitvaror: vitvarorPrompt,
}

/**
 * Builds the optional taxonomy-constraint block. When the selected category is
 * known we pin componentCategory to it, and when its component types are known
 * we force the model to classify componentType into one of the real type names
 * (or null) instead of inventing free text.
 */
const buildTaxonomyConstraint = (
  categoryName?: string,
  availableTypes?: string[]
): string => {
  if (!categoryName) {
    return ''
  }

  const pin = `Komponenten tillhör kategorin "${categoryName}". Sätt componentCategory till "${categoryName}".`

  if (!availableTypes?.length) {
    return pin
  }

  const list = availableTypes.map((type) => `- ${type}`).join('\n')
  return `${pin}\nVälj componentType EXAKT från följande lista (kopiera stavningen) eller sätt componentType till null om ingen passar:\n${list}`
}

/**
 * Resolves the system prompt for component image analysis.
 *
 * Composes the domain overlay for the given category (or the general fallback)
 * with the shared base instructions, an optional taxonomy constraint, and the
 * JSON output contract — so every prompt behaves consistently and returns the
 * same AIComponentAnalysis shape.
 *
 * @param categoryName - Category name from the component library (optional)
 * @param availableTypes - Component type names under the category (optional);
 *   when provided, the model is constrained to pick componentType from them
 * @returns Composed system prompt string
 */
export const resolveComponentAnalysisPrompt = (
  categoryName?: string,
  availableTypes?: string[]
): string => {
  const key = categoryName?.trim().toLowerCase()
  const domain = (key && OVERLAYS[key]) || generalPrompt
  const constraint = buildTaxonomyConstraint(categoryName, availableTypes)

  return [domain, BASE_INSTRUCTIONS, constraint, OUTPUT_FORMAT]
    .filter(Boolean)
    .join('\n\n')
}
