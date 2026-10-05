import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Environment variables that may be injected into index.html at startup. */
const ENV_VARS = [
  'VITE_CORE_API_URL',
  'VITE_KEYCLOAK_URL',
  'VITE_KEYCLOAK_REALM',
  'VITE_KEYCLOAK_CLIENT_ID',
  'VITE_KEYCLOAK_REDIRECT_URI',
  'VITE_LEASING_BFF_URL',
]

/**
 * Inject variable values for ENV_VARS from the environment, if they have
 * values. Defaults are set in the build, and may be overridden at startup.
 */
export const injectEnv = (html, env) =>
  ENV_VARS.reduce(
    (html, vbl) =>
      env[vbl] !== undefined
        ? html.replace(
            new RegExp(`(${vbl}\\s*:\\s*')([^']*)(')`),
            `$1${env[vbl]}$3`
          )
        : html,
    html
  )

export const injectRuntimeEnv = (
  indexHtmlPath = '/usr/share/nginx/html/index.html',
  env = process.env
) => {
  const html = injectEnv(readFileSync(indexHtmlPath, 'utf8'), env)
  writeFileSync(indexHtmlPath, html, 'utf8')
}

// Only rewrite when executed as a script, so vite.config.ts can import this safely.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const indexHtmlPath = process.argv[2]
  injectRuntimeEnv(indexHtmlPath)
}
