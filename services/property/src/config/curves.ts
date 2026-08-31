import 'dotenv/config'

export default {
  baseUrl: process.env.CURVES__BASE_URL || 'https://integration.ecoguard.se',
  username: process.env.CURVES__USERNAME || '',
  password: process.env.CURVES__PASSWORD || '',
  domain: process.env.CURVES__DOMAIN || 'Mimer',
}
