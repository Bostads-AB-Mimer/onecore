import axios from 'axios'
import bergetConfig from '../config/berget'
import type { AIComponentAnalysis } from '../types/component'
import { resolveComponentAnalysisPrompt } from '../prompts/component-analysis'

// AI-powered component image analysis. The system prompt is selected per
// component category (see ../prompts/component-analysis), with a general
// fallback for categories without a dedicated prompt.
// TODO: Future enhancement - Add TYPE_PLATE mode parameter for nameplate reading
// TODO: Future enhancement - Add confidence threshold warnings
// TODO: Future enhancement - Implement retry logic with exponential backoff

/**
 * Analyzes component image(s) using the Berget AI API
 * Single or dual image mode. The prompt is built from the selected category and
 * the component types available under it (see ../prompts/component-analysis).
 *
 * @param base64Image - Primary base64 encoded image string (with or without data URI prefix)
 * @param additionalImage - Optional additional base64 image (e.g., typeplate + product photo)
 * @param taxonomy - Optional category context: the category name (selects the
 *   prompt) and the component type names under it (constrains the classification)
 * @returns Promise<AIComponentAnalysis> - Structured analysis of the component
 * @throws Error on API failure, timeout, or invalid response
 */
export const analyzeComponentImage = async (
  base64Image: string,
  additionalImage?: string,
  taxonomy?: { categoryName?: string; availableTypes?: string[] }
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
      {
        type: 'text',
        text: resolveComponentAnalysisPrompt(
          taxonomy?.categoryName,
          taxonomy?.availableTypes
        ),
      },
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
