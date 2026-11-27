// Renders every system email from the DB, as it would be sent, with fixture
// values for review (run migrations first):
//   pnpm exec ts-node src/services/template-service/preview.ts [--send <address>]
// Writes build/email-previews/<systemKey>.html and .txt; --send also mails
// each one to <address> through the configured Infobip account.
import fs from 'node:fs'
import path from 'node:path'

import { db } from '../../common/db'
import { sendRenderedEmail } from '../infobip-service/adapters/email-adapter'
import { getSystemTemplate } from './adapters/db'
import { renderEmail, SYSTEM_TEMPLATE_KEYS } from './system-templates'
import { SYSTEM_EMAIL_FIXTURES } from './system-email-fixtures'

const OUT_DIR = path.join(__dirname, '../../../build/email-previews')

const main = async () => {
  const sendIndex = process.argv.indexOf('--send')
  const sendTo = sendIndex === -1 ? null : process.argv[sendIndex + 1]
  if (sendIndex !== -1 && !sendTo) throw new Error('--send needs an address')

  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const systemKey of SYSTEM_TEMPLATE_KEYS) {
    const rendered = renderEmail(
      await getSystemTemplate(systemKey),
      SYSTEM_EMAIL_FIXTURES[systemKey]
    )
    const base = path.join(OUT_DIR, systemKey)
    fs.writeFileSync(`${base}.html`, rendered.html)
    fs.writeFileSync(
      `${base}.txt`,
      `Ämne: ${rendered.subject}\n\n${rendered.text}\n`
    )
    if (sendTo) {
      // Key in the subject so the test inbox shows which template is which.
      await sendRenderedEmail(sendTo, {
        ...rendered,
        subject: `[${systemKey}] ${rendered.subject}`,
      })
    }
  }
  console.log(
    `Wrote previews to ${OUT_DIR}${sendTo ? ` and sent them to ${sendTo}` : ''}`
  )
}

if (require.main === module) {
  main()
    .catch((err: unknown) => {
      console.error(err)
      process.exitCode = 1
    })
    .finally(() => db.destroy())
}
