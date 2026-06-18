import axios from 'axios'
import { ZodError } from 'zod'
import { logger } from '@onecore/utilities'
import bergetConfig from '../config/berget'
import {
  AIComponentAnalysisSchema,
  type AIComponentAnalysis,
} from '../types/component'
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
  taxonomy?: { categoryName: string; availableTypes: string[] }
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

    const analysis = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // The AI output is untrusted: clamp near-miss numeric values rather than
    // failing the whole analysis on them, then validate the final shape so an
    // out-of-contract response fails here (with a curated error) instead of
    // failing core's response parse downstream.
    const roundedWarranty =
      typeof analysis.warrantyMonths === 'number' &&
      Number.isFinite(analysis.warrantyMonths)
        ? Math.round(analysis.warrantyMonths)
        : null
    const warrantyMonths =
      roundedWarranty !== null && roundedWarranty >= 0 ? roundedWarranty : null

    const confidence =
      typeof analysis.confidence === 'number' &&
      Number.isFinite(analysis.confidence)
        ? Math.min(1, Math.max(0, analysis.confidence))
        : 0

    return AIComponentAnalysisSchema.parse({
      componentCategory: analysis.componentCategory ?? null,
      componentType: analysis.componentType ?? null,
      componentSubtype: analysis.componentSubtype ?? null,
      manufacturer: analysis.manufacturer ?? null,
      model: analysis.model ?? null,
      serialNumber: analysis.serialNumber ?? null,
      estimatedAge: analysis.estimatedAge ?? null,
      condition: analysis.condition ?? null,
      specifications: analysis.specifications ?? null,
      dimensions: analysis.dimensions ?? null,
      warrantyMonths,
      ncsCode: analysis.ncsCode ?? null,
      additionalInformation: analysis.additionalInformation ?? null,
      confidence,
    })
  } catch (error) {
    // The curated rethrows below hide diagnostic detail from the API
    // consumer, so record the raw error (zod issues, JSON syntax error,
    // axios failure) here before mapping it
    logger.error({ err: error }, 'berget-adapter.analyzeComponentImage')

    if (error instanceof ZodError) {
      // Don't leak raw zod issues to the API consumer
      throw new Error('AI response did not match the expected format')
    }

    if (error instanceof SyntaxError) {
      // The regex-extracted brace span wasn't valid JSON — same curated
      // message as when no JSON is found at all
      throw new Error(
        'AI analysis failed: Could not parse JSON from AI response'
      )
    }

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
