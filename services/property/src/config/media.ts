import 'dotenv/config'

export default {
  // Public host for residence photos and energy declarations.
  baseUrl: process.env.MEDIA__BASE_URL || 'https://pub.mimer.nu',
}
