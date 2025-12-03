import 'dotenv/config'

export default {
  apiKey: process.env.BERGET__API_KEY || '',
  apiUrl:
    process.env.BERGET__API_URL || 'https://api.berget.ai/v1/chat/completions',
  model: process.env.BERGET__MODEL || 'mistral-small',
  maxTokens: parseInt(process.env.BERGET__MAX_TOKENS || '2000'),
  temperature: parseFloat(process.env.BERGET__TEMPERATURE || '0.1'),
}
