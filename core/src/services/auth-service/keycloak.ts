import keycloak from 'keycloak-koa'
import config from '../../common/config'
import { logger } from 'onecore-utilities'

// Initialize Keycloak with configuration
const auth = keycloak({
  keycloakUrl: `${config.auth.keycloak.url}/realms/${config.auth.keycloak.realm}`,
  clientId: config.auth.keycloak.clientId,
  clientSecret: config.auth.keycloak.clientSecret,
})

// Log Keycloak configuration on startup
logger.info(
  `Keycloak initialized with URL: ${config.auth.keycloak.url}/realms/${config.auth.keycloak.realm}`
)

export default auth
