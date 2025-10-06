import { readFileSync, writeFileSync} from 'node:fs'
import { pathToFileURL } from 'node:url'

/**
 * These are the environment variables that may be injected at startup.
 *
 * They could theoretically be parsed from the HTML template, for the sake
 * of de-deuplication. Another story, another day. Not the same bat channel.
 */
const ENV_VARS = [
  'VITE_CORE_API_URL',
  'VITE_KEYCLOAK_URL',
  'VITE_KEYCLOAK_REALM',
  'VITE_KEYCLOAK_CLIENT_ID',
  'VITE_KEYCLOAK_REDIRECT_URI'
]

/**
 * Inject variable values for ENV_VARS from the environment, if
 * they have values. This allows setting default values in the build
 * step, and optionally override them at startup.
 *
 * @param html - The index.html file, as string.
 * @param env - The environment variable dict, from which to select values
 */
export const injectEnv = (html, env) =>
  ENV_VARS.reduce(
    (html, vbl) =>
       env[vbl] !== undefined ? html.replace(
        new RegExp(`(${vbl}\s*:\s*')([^']*)(')`),
        `$1${env[vbl]}$3`
       ): html,
    html
  )

/**
 * Read the index.html from the specified or default location and write
 * it back with the injected variable values from `env`.
 */
export const injectRuntimeEnv = (
  indexHtmlPath = '/src/share/nginx/html/index.html',
  env = process.env
) => {
  const html = injectEnv(readFileSync(indexHtmlPath, 'utf8'), env)
  writeFileSync(indexHtmlPath, html, 'utf8')
}

/**
 * Execution guard. Don't go rewriting anything unless this file is being
 * executed as a script. Lets this file be imported safely by vite.config.ts
 */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const indexHtmlPath = process.argv[2]
  injectRuntimeEnv(indexHtmlPath)
}
