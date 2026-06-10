import { resolveComponentAnalysisPrompt } from './index'
import { BASE_INSTRUCTIONS } from './base'
import { vitvarorPrompt } from './vitvaror'
import { generalPrompt } from './general'
import { OUTPUT_FORMAT } from './output-format'

describe('resolveComponentAnalysisPrompt', () => {
  it('returns the vitvaror prompt for the Vitvaror category', () => {
    const prompt = resolveComponentAnalysisPrompt('Vitvaror')
    expect(prompt).toContain(vitvarorPrompt)
    expect(prompt).not.toContain(generalPrompt)
  })

  it('matches the category name case-insensitively and trims whitespace', () => {
    const prompt = resolveComponentAnalysisPrompt('  vitVAROR  ')
    expect(prompt).toContain(vitvarorPrompt)
  })

  it('falls back to the general prompt for an unmatched category', () => {
    const prompt = resolveComponentAnalysisPrompt('VVS')
    expect(prompt).toContain(generalPrompt)
    expect(prompt).not.toContain(vitvarorPrompt)
  })

  it('falls back to the general prompt when no category is provided', () => {
    const prompt = resolveComponentAnalysisPrompt()
    expect(prompt).toContain(generalPrompt)
  })

  it('always includes the shared base instructions and JSON output contract', () => {
    for (const category of ['Vitvaror', 'VVS', undefined]) {
      const prompt = resolveComponentAnalysisPrompt(category)
      expect(prompt).toContain(BASE_INSTRUCTIONS)
      expect(prompt).toContain(OUTPUT_FORMAT)
    }
  })

  it('constrains componentType to the available types when provided', () => {
    const prompt = resolveComponentAnalysisPrompt('Vitvaror', [
      'Kylskåp',
      'Diskmaskin',
    ])
    expect(prompt).toContain('Välj componentType EXAKT')
    expect(prompt).toContain('- Kylskåp')
    expect(prompt).toContain('- Diskmaskin')
  })

  it('pins the category but adds no type list when the category has no types', () => {
    const prompt = resolveComponentAnalysisPrompt('Vitvaror', [])
    expect(prompt).toContain('tillhör kategorin "Vitvaror"')
    expect(prompt).not.toContain('Välj componentType EXAKT')
  })

  it('adds no taxonomy constraint when no category is provided', () => {
    const prompt = resolveComponentAnalysisPrompt(undefined, ['Kylskåp'])
    expect(prompt).not.toContain('tillhör kategorin')
    expect(prompt).not.toContain('Välj componentType EXAKT')
  })
})
