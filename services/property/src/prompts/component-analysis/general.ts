// General fallback domain framing, used when the selected component category
// has no dedicated overlay. Deliberately category-agnostic: it only frames the
// expert role broadly. The actual analysis instructions live in BASE_INSTRUCTIONS
// (./base) and are shared with every category.
export const generalPrompt = `Du är en expert på att identifiera och bedöma fastighetskomponenter, t.ex. vitvaror, VVS, ventilation, värmesystem, el, ytskikt och fasta inventarier (listan är inte uttömmande).`
