package nu.mimer.keycloak.bankid;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Response;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.jboss.logging.Logger;
import org.keycloak.broker.provider.AbstractIdentityProvider;
import org.keycloak.broker.provider.AuthenticationRequest;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.broker.provider.IdentityProvider;
import org.keycloak.events.EventBuilder;
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

    @Override
    public Response performLogin(AuthenticationRequest request) {
        String endUserIp = session.getContext().getConnection().getRemoteAddr();
        String returnTo = returnUrl(request.getRedirectUri(), request.getState().getEncoded());
        try {
            MimerBankIdClient.Created tx = new MimerBankIdClient(session, getConfig()).createAuth(endUserIp, returnTo);
            request.getAuthenticationSession().setAuthNote(NOTE_TX, tx.id());
            LOG.debugf("Created Mimer BankID transaction %s", tx.id());
            return Response.seeOther(URI.create(tx.accessUrl())).build();
        } catch (Exception e) {
            // Throwing here would end on Keycloak's "could not send authentication request" page.
            // Going through our own return endpoint without a transaction ends in callback.error
            // instead, which puts the user back on the login page with our message.
            LOG.warnf("Could not create Mimer BankID transaction: %s", e.getMessage());
            request.getAuthenticationSession().removeAuthNote(NOTE_TX);
            return Response.seeOther(URI.create(returnTo)).build();
        }
    }

    @Override
    public Object callback(RealmModel realm, IdentityProvider.AuthenticationCallback callback, EventBuilder event) {
        return new Endpoint(this, callback);
    }

    @Override
    public Response retrieveToken(KeycloakSession session, FederatedIdentityModel identity) {
        return Response.status(Response.Status.BAD_REQUEST).build();
    }

    public static class Endpoint {
        private final MimerBankIdIdentityProvider provider;
        private final IdentityProvider.AuthenticationCallback callback;

        Endpoint(MimerBankIdIdentityProvider provider, IdentityProvider.AuthenticationCallback callback) {
            this.provider = provider;
            this.callback = callback;
        }

        @GET
        @Path("/return")
        public Response back(@QueryParam("state") String state, @QueryParam("transaction_id") String transactionId) {
            // Throws a Keycloak error page itself when state is missing, stale or from another browser.
            AuthenticationSessionModel authSession = callback.getAndVerifyAuthenticationSession(state);

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

            JsonNode tx;
            try {
                tx = new MimerBankIdClient(provider.session, provider.getConfig()).get(transactionId);
            } catch (Exception e) {
                LOG.warnf("Could not read Mimer BankID transaction %s: %s", transactionId, e.getMessage());
                return callback.error(provider.getConfig(), LOGIN_FAILED);
            }

            switch (TransactionCheck.evaluate(tx)) {
                case CANCELLED:
                    return callback.cancelled(provider.getConfig());
                case REJECTED:
                    LOG.warnf("Mimer BankID transaction %s rejected: method=%s status=%s hint=%s", transactionId,
                            tx.path("method").asText(), tx.path("status").asText(),
                            tx.path("processingInfo").path("hintCode").asText());
                    return callback.error(provider.getConfig(), LOGIN_FAILED);
                default:
                    break;
            }

            String pnr = TransactionCheck.personalNumber(tx);
            BrokeredIdentityContext identity = new BrokeredIdentityContext(pnr, provider.getConfig());
            identity.setUsername(pnr);
            identity.setIdp(provider);
            identity.setAuthenticationSession(authSession);
            return callback.authenticated(identity);
        }
    }
}
