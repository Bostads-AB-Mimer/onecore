import axios from 'axios'
import bergetConfig from '../config/berget'
import type { AIComponentAnalysis } from '../types/component'

// MVP: AI-powered component analysis focused on Swedish appliances (vitvaror)
// TODO: Future enhancement - Add TYPE_PLATE mode parameter for nameplate reading
// TODO: Future enhancement - Add support for other component categories (HVAC, plumbing, etc.)
// TODO: Future enhancement - Add confidence threshold warnings
// TODO: Future enhancement - Implement retry logic with exponential backoff

const SYSTEM_PROMPT = `Du är en expert på svenska vitvaror och hushållsapparater. Analysera bilden/bilderna och extrahera relevant information.

Du kan få EN eller TVÅ bilder:

Om EN bild (typskylt):
- Extrahera all teknisk data (modell, serienummer, specifikationer, dimensioner, garanti)
- Sätt componentType till null om du inte kan identifiera produkttypen från texten

Om EN bild (produktbild):
- Identifiera componentCategory, componentType och componentSubtype visuellt
- Bedöm skick (condition) och uppskatta ålder (estimatedAge)
- Extrahera synlig data om tillgänglig

Om TVÅ bilder:
- Kombinera information från båda bilderna
- Använd produktbilden för att identifiera componentType och bedöma skick
- Använd typskylten för exakta tekniska data (modell, serienummer, specifikationer)

Fokusera på dessa typer av vitvaror:
- Kylskåp, Kyl/Frys-kombinationer
- Spisar, Ugnar, Häll
- Diskmaskiner
- Tvättmaskiner, Torktumlare, Torkskåp
- Mikrovågsugnar
- Fläktar, Köksfläktar
- Värmepumpar

Svara ENDAST med JSON i följande format (inget annat text):
{
  "componentCategory": "övergripande kategori (för vitvaror: 'Vitvaror')",
  "componentType": "typ av komponent (t.ex. 'Kylskåp', 'Diskmaskin', 'Tvättmaskin', 'Spis')",
  "componentSubtype": "specifik variant (t.ex. '60cm integrerad', 'Fristående 190-215 liter', 'Kyl/frys-kombination', annars null)",
  "manufacturer": "tillverkare/märke (om synligt, annars null)",
  "model": "modellnamn/nummer (om synligt, annars null)",
  "serialNumber": "serienummer (om synligt på bild, annars null)",
  "estimatedAge": "uppskattad ålder som text (t.ex. '5-10 år', 'Ny', 'Okänd')",
  "condition": "visuellt skick som text (t.ex. 'Utmärkt', 'Gott', 'Normalt', 'Slitet')",
  "specifications": "tekniska specifikationer om synliga (t.ex. 'Energiklass A++, Volym 343L')",
  "dimensions": "fysiska mått om synliga på etikett (t.ex. 'BxDxH: 60x60x85 cm', annars null)",
  "warrantyMonths": "garantitid i månader om synlig (t.ex. från garantietikett, annars null)",
  "ncsCode": "NCS-färgkod om synlig (format XXX eller XXX.XXX, annars null)",
  "additionalInformation": "övrig relevant information synlig på produkten (annars null)",
  "confidence": 0.85
}

VIKTIGT: Fyll ENDAST i fält där information är synlig eller kan extraheras från bilden. Använd null för fält där du inte är säker. Var konservativ med confidence-värdet (0.0-1.0).`

/**
 * Analyzes component image(s) using the Berget AI API
 * MVP version: Single or dual image mode, focused on Swedish appliances (vitvaror)
 *
 * @param base64Image - Primary base64 encoded image string (with or without data URI prefix)
 * @param additionalImage - Optional additional base64 image (e.g., typeplate + product photo)
 * @returns Promise<AIComponentAnalysis> - Structured analysis of the component
 * @throws Error on API failure, timeout, or invalid response
 */
export const analyzeComponentImage = async (
  base64Image: string,
  additionalImage?: string
): Promise<AIComponentAnalysis> => {
  try {
    // Ensure primary image has data URI prefix
    let imageData = base64Image
    if (!imageData.startsWith('data:')) {
      // Assume JPEG if no prefix (most common for photos)
      imageData = `data:image/jpeg;base64,${imageData}`
    }

    // Build message content array with primary image
    const messageContent: Array<{
      type: string
      text?: string
      image_url?: { url: string }
    }> = [
      { type: 'text', text: SYSTEM_PROMPT },
      { type: 'image_url', image_url: { url: imageData } },
    ]

    // Add additional image if provided
    if (additionalImage) {
      let additionalImageData = additionalImage
      if (!additionalImageData.startsWith('data:')) {
        additionalImageData = `data:image/jpeg;base64,${additionalImageData}`
      }
      messageContent.push({
        type: 'image_url',
        image_url: { url: additionalImageData },
      })
    }

    const response = await axios.post(
      bergetConfig.apiUrl,
      {
        model: bergetConfig.model,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
        max_tokens: bergetConfig.maxTokens,
        temperature: bergetConfig.temperature,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bergetConfig.apiKey}`,
        },
        timeout: 30000, // 30 second timeout
      }
    )

    const content = response.data?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('No content in AI response')
    }

    // Extract JSON from response (AI might wrap it in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from AI response')
    }

    const analysis = JSON.parse(jsonMatch[0]) as AIComponentAnalysis

    // Ensure all fields exist (default to null if missing)
    return {
      // Basic identification fields (three-level taxonomy)
      componentCategory: analysis.componentCategory ?? null,
      componentType: analysis.componentType ?? null,
      componentSubtype: analysis.componentSubtype ?? null,
      manufacturer: analysis.manufacturer ?? null,
      model: analysis.model ?? null,
      serialNumber: analysis.serialNumber ?? null,

      // Condition and age assessment
      estimatedAge: analysis.estimatedAge ?? null,
      condition: analysis.condition ?? null,

      // Technical information from labels
      specifications: analysis.specifications ?? null,
      dimensions: analysis.dimensions ?? null,
      warrantyMonths: analysis.warrantyMonths ?? null,

      // Classification codes
      ncsCode: analysis.ncsCode ?? null,

      // Additional information
      additionalInformation: analysis.additionalInformation ?? null,

      // Confidence score
      confidence: analysis.confidence ?? 0,
    }
  } catch (error) {
    // Handle specific error cases
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Berget AI API key')
      }
      if (error.response?.status === 429) {
        throw new Error('Berget AI rate limit exceeded')
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Berget AI request timeout')
      }
    }

    // Re-throw with context
    if (error instanceof Error) {
      throw new Error(`AI analysis failed: ${error.message}`)
    }
    throw new Error('AI analysis failed with unknown error')
  }
}
