package nu.mimer.keycloak.bankid;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import nu.mimer.keycloak.bankid.Transaction.Outcome;
import org.jboss.logging.Logger;
import org.keycloak.broker.provider.AbstractIdentityProvider;
import org.keycloak.broker.provider.AuthenticationRequest;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.broker.provider.IdentityProvider;
import org.keycloak.events.Errors;
import org.keycloak.events.EventBuilder;
import org.keycloak.events.EventType;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.FederatedIdentityModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * Logs a tenant in with BankID through Mimer BankID (Mimer's own transaction API in Azure).
 *
 * <p>Start: create an Auth transaction and send the browser to its hosted page. Back: Mimer BankID
 * redirects to {@code …/broker/<alias>/endpoint/return?state=…&transaction_id=…&success=…}; the
 * transaction is read again server side and only its own data decides the outcome.
 *
 * <p>Never log the personnummer. Transaction ids, HTTP statuses and Entra error codes are fine.
 */
public class MimerBankIdIdentityProvider extends AbstractIdentityProvider<MimerBankIdConfig> {

    /** Auth note holding the transaction this login session started. Strings only, so it survives node hops. */
    static final String NOTE_TX = "mimer-bankid.transaction-id";
    /** Message key in the login theme. */
    static final String LOGIN_FAILED = "bankidLoginFailed";
    /** Keycloak's own message keys, the same ones its OAuth2 brokers show for these cases. */
    static final String MISSING_STATE = "identityProviderMissingStateMessage";
    static final String UNEXPECTED_ERROR = "identityProviderUnexpectedErrorMessage";
    private static final Logger LOG = Logger.getLogger(MimerBankIdIdentityProvider.class);

    public MimerBankIdIdentityProvider(KeycloakSession session, MimerBankIdConfig config) {
        super(session, config);
    }

    /**
     * The URL Mimer BankID sends the browser back to. It needs its own path below the broker
     * endpoint: a bare {@code @GET} on {@code /endpoint} answers 405 in Keycloak 26.3.3.
     */
    static String returnUrl(String brokerEndpoint, String encodedState) {
        return brokerEndpoint + "/return?state=" + URLEncoder.encode(encodedState, StandardCharsets.UTF_8);
    }

    /** Exception type and message for a log line; a bare NPE message is just "null". */
    static String describe(Exception e) {
        return e.getClass().getSimpleName() + (e.getMessage() == null ? "" : ": " + e.getMessage());
    }

    MimerBankIdClient client() {
        return new MimerBankIdClient(session, getConfig());
    }

    @Override
    public Response performLogin(AuthenticationRequest request) {
        String endUserIp = session.getContext().getConnection().getRemoteAddr();
        String returnTo = returnUrl(request.getRedirectUri(), request.getState().getEncoded());
        try {
            MimerBankIdClient.Created tx = client().createAuth(endUserIp, returnTo);
            request.getAuthenticationSession().setAuthNote(NOTE_TX, tx.id());
            LOG.debugf("Created Mimer BankID transaction %s", tx.id());
            return Response.seeOther(URI.create(tx.accessUrl())).build();
        } catch (Exception e) {
            // Throwing here would end on Keycloak's "could not send authentication request" page.
            // Going through our own return endpoint without a transaction ends in callback.error
            // instead, which puts the user back on the login page with our message.
            LOG.warnf("Could not create Mimer BankID transaction: %s", describe(e));
            request.getAuthenticationSession().removeAuthNote(NOTE_TX);
            return Response.seeOther(URI.create(returnTo)).build();
        }
    }

    @Override
    public Object callback(RealmModel realm, IdentityProvider.AuthenticationCallback callback, EventBuilder event) {
        return new Endpoint(this, callback, event);
    }

    @Override
    public Response retrieveToken(KeycloakSession session, FederatedIdentityModel identity) {
        return Response.status(Response.Status.BAD_REQUEST).build();
    }

    public static class Endpoint {
        private final MimerBankIdIdentityProvider provider;
        private final IdentityProvider.AuthenticationCallback callback;
        private final EventBuilder event;

        Endpoint(MimerBankIdIdentityProvider provider, IdentityProvider.AuthenticationCallback callback, EventBuilder event) {
            this.provider = provider;
            this.callback = callback;
            this.event = event;
        }

        /**
         * Error handling mirrors Keycloak's own OAuth2 broker endpoint: Keycloak's answers for a stale,
         * reused or already finished login pass through as they are (an expired page, or a redirect back
         * to the app), anything unexpected ends on an error page instead of a raw 500.
         */
        @GET
        @Path("/return")
        public Response back(@QueryParam("state") String state, @QueryParam("transaction_id") String transactionId) {
            if (state == null) {
                LOG.warn("Mimer BankID return without state");
                return errorPage(MISSING_STATE);
            }
            AuthenticationSessionModel authSession;
            try {
                authSession = callback.getAndVerifyAuthenticationSession(state);
            } catch (WebApplicationException e) {
                return e.getResponse();
            } catch (RuntimeException e) {
                // e.g. a state that is not base64url
                LOG.warnf("Mimer BankID return with an unreadable state: %s", describe(e));
                return errorPage(UNEXPECTED_ERROR);
            }
            provider.session.getContext().setAuthenticationSession(authSession);
            try {
                return finish(authSession, transactionId);
            } catch (WebApplicationException e) {
                return e.getResponse();
            } catch (RuntimeException e) {
                LOG.error("Mimer BankID return failed", e);
                return errorPage(UNEXPECTED_ERROR);
            }
        }

        private Response finish(AuthenticationSessionModel authSession, String transactionId) {
            // One use per transaction: the note goes whatever happens next.
            String expected = authSession.getAuthNote(NOTE_TX);
            authSession.removeAuthNote(NOTE_TX);
            if (expected == null) {
                // Start failed (already logged), or a callback for a login that has no transaction.
                return callback.error(provider.getConfig(), LOGIN_FAILED);
            }
            if (!expected.equals(transactionId)) {
                LOG.warnf("Mimer BankID transaction id did not match this login session (expected %s)", expected);
                return callback.error(provider.getConfig(), LOGIN_FAILED);
            }

            Transaction tx;
            try {
                tx = provider.client().get(transactionId);
            } catch (Exception e) {
                LOG.warnf("Could not read Mimer BankID transaction %s: %s", transactionId, describe(e));
                return callback.error(provider.getConfig(), LOGIN_FAILED);
            }

            return switch (tx.outcome()) {
                case Outcome.Cancelled cancelled -> callback.cancelled(provider.getConfig());
                case Outcome.Rejected rejected -> {
                    LOG.warnf("Mimer BankID transaction %s rejected: %s", transactionId, rejected.reason());
                    yield callback.error(provider.getConfig(), LOGIN_FAILED);
                }
                case Outcome.Accepted accepted -> callback.authenticated(identity(accepted.personalNumber(), authSession));
            };
        }

        /** The personnummer becomes the brokered username; the realm's first-login flow links it to the user. */
        private BrokeredIdentityContext identity(String personalNumber, AuthenticationSessionModel authSession) {
            BrokeredIdentityContext identity = new BrokeredIdentityContext(personalNumber, provider.getConfig());
            identity.setUsername(personalNumber);
            identity.setIdp(provider);
            identity.setAuthenticationSession(authSession);
            return identity;
        }

        /** Keycloak's error page, as {@code ErrorPage.error} renders it (that class is not part of the SPI). */
        private Response errorPage(String message) {
            event.event(EventType.IDENTITY_PROVIDER_LOGIN);
            event.error(Errors.IDENTITY_PROVIDER_LOGIN_FAILURE);
            return provider.session.getProvider(LoginFormsProvider.class)
                    .setError(message)
                    .createErrorPage(Response.Status.BAD_GATEWAY);
        }
    }
}
