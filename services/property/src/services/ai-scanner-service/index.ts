import { logger } from '@onecore/utilities'
import {
  AnalyzeScannerImageRequest,
  AIScannerAnalysisResult,
} from '../../types/ai-analysis'

const BERGET_API_URL = 'https://api.berget.ai/v1/chat/completions'
const BERGET_API_KEY = process.env.BERGET_API_KEY

if (!BERGET_API_KEY) {
  logger.warn('BERGET_API_KEY not set in environment variables')
}

// Get all component types from the scanner app's category structure
// In production, this could be fetched from a database or config service
function getComponentTypes(): string[] {
  return [
    'Kylskåp',
    'Frys',
    'Spis',
    'Ugn',
    'Diskmaskin',
    'Tvättmaskin',
    'Torktumlare',
    'Mikrovågsugn',
    'Köksfläkt',
    'Golv',
    'Vägg',
    'Tak',
    'Kakel/Klinker',
    'Parkett',
    'Laminat',
    'Matta',
    'Vinyl/Plastmatta',
    'Fasad',
    'Tak',
    'Balkong',
    'Fönster',
    'Entrédörrar',
    'Radiator',
    'Golvvärme',
    'Värmepump',
    'Panna',
    'Ventilationsaggregat',
    'Frånluftsfläkt',
    'Ventil',
    'Varmvattenberedare',
    'Toalett',
    'Handfat',
    'Badkar',
    'Dusch',
    'Diskho',
    'Blandare',
    'Elcentral',
    'Eluttag',
    'Belysning',
    'Strömbrytare',
    'Köksskåp',
    'Garderob',
    'Bänkskiva',
    'Innerdörrar',
  ]
}

function buildPrompt(feedback?: string, isTypePlate?: boolean): string {
  const componentTypesList = getComponentTypes().join(', ')

  const basePrompt = isTypePlate
    ? `Du är en expert på att läsa typskyltar på vitvaror och fasta installationer i fastigheter. Analysera bilden på typskylten och extrahera all synlig information.

VIKTIGT: Klassificera komponenten till rätt typ från följande lista:
${componentTypesList}

Svara ENDAST med JSON i följande format (inget annat):
{
  "type": "typ av objekt - MÅSTE vara en av typerna från listan ovan som bäst matchar",
  "brand": "märke/tillverkare (om synligt, annars 'Okänt')",
  "model": "modellnamn (om synligt, annars 'Okänd')",
  "typeNumber": "typnummer/artikelnummer från typskylten (om synligt, annars null)",
  "serialNumber": "serienummer från typskylten (om synligt, annars null)",
  "estimatedAge": nummer i år (uppskattad ålder om det går att utläsa från tillverkningsdatum, annars 0),
  "condition": "good",
  "confidence": nummer mellan 0 och 1 (hur säker du är på analysen)
}

Leta särskilt efter: E-nr, Art.nr, Type, Model, S/N, Serial, Serienr, Tillverkningsår.`
    : `Du är en expert på att inventera fastighetskomponenter. Analysera bilden och identifiera objektet.

Du kan identifiera följande typer av komponenter:
- VITVAROR: Kylskåp, Frys, Spis, Ugn, Diskmaskin, Tvättmaskin, Torktumlare, Mikrovågsugn, Köksfläkt
- INVÄNDIGA YTSKIKT: Golv, Vägg, Tak, Kakel/Klinker, Parkett, Laminat, Matta, Vinyl/Plastmatta
- UTVÄNDIGA YTSKIKT: Fasad, Tak (yttertak), Balkong, Fönster, Entrédörrar
- VÄRMESYSTEM: Radiator, Golvvärme, Värmepump, Panna
- VENTILATION: Ventilationsaggregat, Frånluftsfläkt, Ventil
- VA-SYSTEM: Varmvattenberedare, Toalett, Handfat, Badkar, Dusch, Diskho, Blandare
- ELSYSTEM: Elcentral, Eluttag, Belysning, Strömbrytare
- FASTA INVENTARIER: Köksskåp, Garderob, Bänkskiva, Innerdörrar

VIKTIGT: Välj den typ som bäst matchar objektet på bilden från listan ovan.

Svara ENDAST med JSON i följande format (inget annat):
{
  "type": "typ av objekt - MÅSTE vara en av typerna från kategorierna ovan",
  "brand": "märke/tillverkare (om synligt, annars 'Okänt')",
  "model": "modellnamn/nummer (om synligt, annars 'Okänd')",
  "typeNumber": "typnummer om synligt på bild (annars null)",
  "serialNumber": "serienummer om synligt på bild (annars null)",
  "estimatedAge": nummer i år (uppskattad ålder baserat på design och slitage)",
  "condition": "good" eller "fair" eller "poor",
  "confidence": nummer mellan 0 och 1 (hur säker du är på analysen)
}`

  if (feedback) {
    return `${basePrompt}

VIKTIG FEEDBACK FRÅN ANVÄNDAREN: ${feedback}

Ta hänsyn till denna feedback när du analyserar bilden.`
  }

  return basePrompt
}

export async function analyzeScannerImage(
  request: AnalyzeScannerImageRequest
): Promise<AIScannerAnalysisResult> {
  const { imageBase64, feedback, isTypePlate } = request

  if (!BERGET_API_KEY) {
    throw new Error('Berget AI API key not configured')
  }

  const prompt = buildPrompt(feedback, isTypePlate)

  try {
    const response = await fetch(BERGET_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BERGET_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageBase64 } },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(
        { status: response.status, errorText },
        'Berget AI API error'
      )
      throw new Error(`AI Analysis failed: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response from AI')
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse AI response')
    }

    const result = JSON.parse(jsonMatch[0]) as Partial<AIScannerAnalysisResult>

    return {
      type: result.type || 'Okänt',
      brand: result.brand || 'Okänt',
      model: result.model || 'Okänd',
      typeNumber: result.typeNumber || null,
      serialNumber: result.serialNumber || null,
      estimatedAge: result.estimatedAge || 0,
      condition: result.condition || 'fair',
      confidence: result.confidence || 0.5,
    }
  } catch (error) {
    logger.error(error, 'Error in analyzeScannerImage')
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Could not reach AI API')
    }
    throw error
  }
}
