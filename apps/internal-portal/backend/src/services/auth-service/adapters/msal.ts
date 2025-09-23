import config from '../../../common/config'
import msal from '@azure/msal-node'
import axios from 'axios'
import {
  AuthAdapter,
  AuthAdapterFactory,
  AuthOptions,
  KoaContext,
} from './types'

const redirectUri = config.auth.msal.redirectUri || config.msal.redirectUri
const postLogoutRedirectUri =
  config.auth.msal.postLogoutRedirectUri || config.msal.postLogoutRedirectUri

const cryptoProvider = new msal.CryptoProvider()

const defaultOptions: AuthOptions = {
  scopes: [],
  redirectUri,
  successRedirect: '/',
  postLogoutRedirectUri,
}

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL Node configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/configuration.md
 */
const msalConfig: msal.Configuration = {
  auth: {
    clientId: config.auth.msal.clientId, // 'Application (client) ID' of app registration in Azure portal - this value is a GUID
    authority: config.auth.msal.cloudInstance + config.auth.msal.tenantId, // Full directory URL, in the form of https://login.microsoftonline.com/<tenant>
    clientSecret: config.auth.msal.clientSecret, // Client secret generated from the app registration in Azure portal
    cloudDiscoveryMetadata: undefined,
    authorityMetadata: undefined,
  },
  system: {
    loggerOptions: {
      loggerCallback(_loglevel: any, message: any, _containsPii: any) {
        console.log(message)
      },
      piiLoggingEnabled: false,
      logLevel: 3,
    },
  },
}

/**
 * Instantiates a new MSAL ConfidentialClientApplication object
 * @param msalConfig: MSAL Node Configuration object
 * @returns
 */
const getMsalInstance = (msalConfig: msal.Configuration) => {
  return new msal.ConfidentialClientApplication(msalConfig)
}

/**
 * Prepares the auth code request parameters and initiates the first leg of auth code flow
 * @param req: Express request object
 * @param res: Express response object
 * @param next: Express next function
 * @param authCodeUrlRequestParams: parameters for requesting an auth code url
 * @param authCodeRequestParams: parameters for requesting tokens using auth code
 */
const redirectToAuthCodeUrl = (
  authCodeUrlRequestParams: any,
  authCodeRequestParams: any,
  msalInstance: msal.ConfidentialClientApplication
) => {
  return async (ctx: KoaContext) => {
    // Generate PKCE Codes before starting the authorization flow
    const { verifier, challenge } = await cryptoProvider.generatePkceCodes()

    if (!ctx.session) {
      throw new Error('Sessions need to be enabled')
    }

    // Set generated PKCE codes and method as session vars
    ctx.session.pkceCodes = {
      challengeMethod: 'S256',
      verifier: verifier,
      challenge: challenge,
    }

    /**
     * By manipulating the request objects below before each request, we can obtain
     * auth artifacts with desired claims. For more information, visit:
     * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationurlrequest
     * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationcoderequest
     **/
    ctx.session.authCodeUrlRequest = {
      ...authCodeUrlRequestParams,
      responseMode: msal.ResponseMode.FORM_POST, // recommended for confidential clients
      codeChallenge: ctx.session.pkceCodes.challenge,
      codeChallengeMethod: ctx.session.pkceCodes.challengeMethod,
    }

    ctx.session.authCodeRequest = {
      ...authCodeRequestParams,
      code: '',
    }

    try {
      const authCodeUrlResponse = await msalInstance.getAuthCodeUrl(
        ctx.session.authCodeUrlRequest
      )
      ctx.redirect(authCodeUrlResponse)
    } catch (error) {
      console.log('error', error)
      ctx.next(error)
    }
  }
}

/**
 * Retrieves cloud discovery metadata from the /discovery/instance endpoint
 * @returns
 */
const getCloudDiscoveryMetadata = async (authority: string) => {
  const endpoint = 'https://login.microsoftonline.com/common/discovery/instance'

  const response = await axios.get(endpoint, {
    params: {
      'api-version': '1.1',
      authorization_endpoint: `${authority}/oauth2/v2.0/authorize`,
    },
  })

  return await response.data
}

/**
 * Retrieves oidc metadata from the openid endpoint
 * @returns
 */
const getAuthorityMetadata = async (authority: string) => {
  const endpoint = `${authority}/v2.0/.well-known/openid-configuration`

  try {
    const response = await axios.get(endpoint)
    return await response.data
  } catch (error) {
    console.log(error)
  }
}

/**
 * Dynamically creates a login middleware with overridable options.
 *
 * Used by the msalAdapter factory function to create a baseline login function
 * and to create a transient on-the-fly-reconfigured variant.
 */
const makeLogin = (options: AuthOptions) => {
  return async (ctx: KoaContext) => {
    /**
     * MSAL Node library allows you to pass your custom state as state parameter in the Request object.
     * The state parameter can also be used to encode information of the app's state before redirect.
     * You can pass the user's state in the app, such as the page or view they were on, as input to this parameter.
     */
    const state = cryptoProvider.base64Encode(
      JSON.stringify({
        successRedirect: options.successRedirect || '/',
      })
    )

    const authCodeUrlRequestParams = {
      state: state,

      /**
       * By default, MSAL Node will add OIDC scopes to the auth code url request. For more information, visit:
       * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
       */
      scopes: options.scopes || [],
      redirectUri: options.redirectUri,
    }

    const authCodeRequestParams = {
      state: state,

      /**
       * By default, MSAL Node will add OIDC scopes to the auth code request. For more information, visit:
       * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
       */
      scopes: options.scopes || [],
      redirectUri: options.redirectUri,
    }

    /**
     * If the current msal configuration does not have cloudDiscoveryMetadata or authorityMetadata, we will
     * make a request to the relevant endpoints to retrieve the metadata. This allows MSAL to avoid making
     * metadata discovery calls, thereby improving performance of token acquisition process. For more, see:
     * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/performance.md
     */
    if (
      !msalConfig.auth.cloudDiscoveryMetadata ||
      !msalConfig.auth.authorityMetadata
    ) {
      const [cloudDiscoveryMetadata, authorityMetadata] = await Promise.all([
        getCloudDiscoveryMetadata(msalConfig.auth.authority ?? ''),
        getAuthorityMetadata(msalConfig.auth.authority ?? ''),
      ])

      msalConfig.auth.cloudDiscoveryMetadata = JSON.stringify(
        cloudDiscoveryMetadata
      )
      msalConfig.auth.authorityMetadata = JSON.stringify(authorityMetadata)
    }

    const msalInstance = getMsalInstance(msalConfig)

    // trigger the first leg of auth code flow
    return redirectToAuthCodeUrl(
      authCodeUrlRequestParams,
      authCodeRequestParams,
      msalInstance
    )(ctx)
  }
}

/**
 * Creates an AuthenticationAdapter that performs authentication directly against
 * an MSAL authentication provider.
 */
export const msalAdapter: AuthAdapterFactory = (
  options: AuthOptions = defaultOptions
): AuthAdapter => {
  return {
    login: makeLogin(options),

    async logout(ctx: KoaContext) {
      /**
       * Construct a logout URI and redirect the user to end the
       * session with Azure AD. For more information, visit:
       * https://docs.microsoft.com/azure/active-directory/develop/v2-protocols-oidc#send-a-sign-out-request
       */
      let logoutUri = `${msalConfig.auth.authority}/oauth2/v2.0/`

      if (!ctx.session) {
        throw new Error('Sessions need to be enabled')
      }

      if (options.postLogoutRedirectUri) {
        logoutUri += `logout?post_logout_redirect_uri=${options.postLogoutRedirectUri}`
      }

      ctx.session = null

      ctx.redirect(logoutUri)
    },

    async acquireToken(ctx: KoaContext) {
      try {
        const msalInstance = getMsalInstance(msalConfig)

        if (!ctx.session) {
          throw new Error('Sessions need to be enabled')
        }

        /**
         * If a token cache exists in the session, deserialize it and set it as the
         * cache for the new MSAL CCA instance. For more, see:
         * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/caching.md
         */
        if (ctx.session.tokenCache) {
          msalInstance.getTokenCache().deserialize(ctx.session.tokenCache)
        }

        const tokenResponse = await msalInstance.acquireTokenSilent({
          account: ctx.session.account,
          scopes: options.scopes || [],
        })

        /**
         * On successful token acquisition, write the updated token
         * cache back to the session. For more, see:
         * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/caching.md
         */
        ctx.session.tokenCache = msalInstance.getTokenCache().serialize()
        ctx.session.accessToken = tokenResponse.accessToken
        ctx.session.idToken = tokenResponse.idToken
        ctx.session.account = tokenResponse.account

        ctx.redirect(options.successRedirect ?? '/')
      } catch (error) {
        if (error instanceof msal.InteractionRequiredAuthError) {
          return makeLogin({
            scopes: options.scopes || [],
            redirectUri: options.redirectUri,
            successRedirect: options.successRedirect || '/',
            postLogoutRedirectUri: options.postLogoutRedirectUri,
          })(ctx)
        }
        console.log('error: ', error)
        ctx.next(error)
      }
    },

    async handleRedirect(ctx: KoaContext) {
      if (!ctx.request.body || !ctx.request.body.state) {
        return ctx.next(new Error('Error: response not found'))
      }

      if (!ctx.session) {
        throw new Error('Sessions need to be enabled')
      }

      const authCodeRequest = {
        ...ctx.session.authCodeRequest,
        code: ctx.request.body.code,
        codeVerifier: ctx.session.pkceCodes.verifier,
      }

      try {
        const msalInstance = getMsalInstance(msalConfig)

        if (ctx.session.tokenCache) {
          msalInstance.getTokenCache().deserialize(ctx.session.tokenCache)
        }

        const tokenResponse = await msalInstance.acquireTokenByCode(
          authCodeRequest,
          ctx.request.body
        )

        //ctx.session.tokenCache = msalInstance.getTokenCache().serialize()
        //ctx.session.idToken = tokenResponse.idToken // something in these two create an invalid cookie - fix!
        ctx.session.account = tokenResponse.account
        ctx.session.isAuthenticated = true

        const state = JSON.parse(
          cryptoProvider.base64Decode(ctx.request.body.state)
        )

        console.log('Login successful, redirecting to', state.successRedirect)

        return ctx.redirect(state.successRedirect)
      } catch (error) {
        console.log('error: ', error)
        ctx.next(error)
      }
    },

    async handleCallback(ctx: KoaContext) {
      ctx.throw('Not valid')
    },
  }
}
