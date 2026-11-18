package nu.mimer.keycloak.bankid;

import static nu.mimer.keycloak.bankid.MimerBankIdIdentityProvider.LOGIN_FAILED;
import static nu.mimer.keycloak.bankid.MimerBankIdIdentityProvider.MISSING_STATE;
import static nu.mimer.keycloak.bankid.MimerBankIdIdentityProvider.NOTE_TX;
import static nu.mimer.keycloak.bankid.MimerBankIdIdentityProvider.UNEXPECTED_ERROR;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.keycloak.broker.provider.AuthenticationRequest;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.broker.provider.IdentityProvider;
import org.keycloak.broker.provider.util.IdentityBrokerState;
import org.keycloak.common.ClientConnection;
import org.keycloak.events.EventBuilder;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.KeycloakContext;
import org.keycloak.models.KeycloakSession;
import org.keycloak.sessions.AuthenticationSessionModel;
import org.mockito.ArgumentCaptor;

class MimerBankIdIdentityProviderTest {

    private static final String PNR = "199001011234";

    private final KeycloakSession session = mock(KeycloakSession.class);
    private final KeycloakContext context = mock(KeycloakContext.class);
    private final LoginFormsProvider forms = mock(LoginFormsProvider.class, RETURNS_SELF);
    private final IdentityProvider.AuthenticationCallback callback = mock(IdentityProvider.AuthenticationCallback.class);
    private final AuthenticationSessionModel authSession = mock(AuthenticationSessionModel.class);
    private final MimerBankIdClient client = mock(MimerBankIdClient.class);
    private final MimerBankIdConfig config = new MimerBankIdConfig();
    private final Response errorPage = Response.status(502).build();
    private final Response callbackAnswer = Response.ok().build();
    private MimerBankIdIdentityProvider provider;
    private MimerBankIdIdentityProvider.Endpoint endpoint;

    @BeforeEach
    void setUp() {
        when(session.getContext()).thenReturn(context);
        when(session.getProvider(LoginFormsProvider.class)).thenReturn(forms);
        when(forms.createErrorPage(any())).thenReturn(errorPage);
        when(callback.error(any(), anyString())).thenReturn(callbackAnswer);
        when(callback.cancelled(any())).thenReturn(callbackAnswer);
        when(callback.authenticated(any())).thenReturn(callbackAnswer);
        provider = spy(new MimerBankIdIdentityProvider(session, config));
        doReturn(client).when(provider).client();
        endpoint = new MimerBankIdIdentityProvider.Endpoint(provider, callback, mock(EventBuilder.class, RETURNS_SELF));
    }

    private void loginStartedWith(String tx) {
        when(callback.getAndVerifyAuthenticationSession("s")).thenReturn(authSession);
        when(authSession.getAuthNote(NOTE_TX)).thenReturn(tx);
    }

    private static Transaction tx(String status, String pnr) {
        return new Transaction("Auth", status, null, pnr);
    }

    @Test
    void missingStateShowsKeycloaksErrorPage() {
        assertSame(errorPage, endpoint.back(null, "tx-1"));
        verify(forms).setError(MISSING_STATE);
        verifyNoInteractions(callback);
    }

    @Test
    void keycloaksOwnAnswerPassesThrough() {
        // e.g. the return URL reloaded after a finished login: Keycloak redirects back to the app
        Response redirect = Response.status(302).header("Location", "http://app/").build();
        when(callback.getAndVerifyAuthenticationSession("s")).thenThrow(new WebApplicationException(redirect));
        assertSame(redirect, endpoint.back("s", "tx-1"));
    }

    @Test
    void unreadableStateShowsErrorPage() {
        when(callback.getAndVerifyAuthenticationSession("a.b.c")).thenThrow(new RuntimeException("Illegal base64url string"));
        assertSame(errorPage, endpoint.back("a.b.c", "tx-1"));
        verify(forms).setError(UNEXPECTED_ERROR);
    }

    @Test
    void loginWithoutTransactionFails() {
        loginStartedWith(null);
        assertSame(callbackAnswer, endpoint.back("s", "tx-1"));
        verify(callback).error(config, LOGIN_FAILED);
        verifyNoInteractions(client);
    }

    @Test
    void otherTransactionFailsWithoutReadingIt() {
        loginStartedWith("tx-mine");
        assertSame(callbackAnswer, endpoint.back("s", "tx-someone-else"));
        verify(authSession).removeAuthNote(NOTE_TX);
        verify(callback).error(config, LOGIN_FAILED);
        verifyNoInteractions(client);
    }

    @Test
    void unreachableMimerBankIdFails() throws Exception {
        loginStartedWith("tx-1");
        when(client.get("tx-1")).thenThrow(new IOException("get transaction: HTTP 503"));
        assertSame(callbackAnswer, endpoint.back("s", "tx-1"));
        verify(callback).error(config, LOGIN_FAILED);
    }

    @Test
    void cancelledGoesBackAsCancel() throws Exception {
        loginStartedWith("tx-1");
        when(client.get("tx-1")).thenReturn(tx("Cancelled", PNR));
        endpoint.back("s", "tx-1");
        verify(callback).cancelled(config);
    }

    @Test
    void rejectedFailsWithOurMessage() throws Exception {
        loginStartedWith("tx-1");
        when(client.get("tx-1")).thenReturn(new Transaction("Auth", "Failed", "TransactionRiskBlocked", null));
        assertSame(callbackAnswer, endpoint.back("s", "tx-1"));
        verify(callback).error(config, LOGIN_FAILED);
        verify(callback, never()).authenticated(any());
    }

    @Test
    void completedLogsInOnceWithThePersonnummer() throws Exception {
        loginStartedWith("tx-1");
        when(client.get("tx-1")).thenReturn(tx("Complete", PNR));

        assertSame(callbackAnswer, endpoint.back("s", "tx-1"));

        verify(authSession).removeAuthNote(NOTE_TX);
        verify(context).setAuthenticationSession(authSession);
        ArgumentCaptor<BrokeredIdentityContext> identity = ArgumentCaptor.forClass(BrokeredIdentityContext.class);
        verify(callback).authenticated(identity.capture());
        assertEquals(PNR, identity.getValue().getId());
        assertEquals(PNR, identity.getValue().getUsername());
        assertSame(authSession, identity.getValue().getAuthenticationSession());
    }

    @Test
    void aTransactionLogsInOnlyOnce() throws Exception {
        // The note is gone after the first return, so the same return again fails without reading it.
        when(callback.getAndVerifyAuthenticationSession("s")).thenReturn(authSession);
        when(authSession.getAuthNote(NOTE_TX)).thenReturn("tx-1", (String) null);
        when(client.get("tx-1")).thenReturn(tx("Complete", PNR));

        endpoint.back("s", "tx-1");
        endpoint.back("s", "tx-1");

        verify(callback).authenticated(any());
        verify(callback).error(config, LOGIN_FAILED);
        verify(client).get("tx-1");
    }

    @Test
    void unexpectedFailureAfterVerifyShowsErrorPage() throws Exception {
        loginStartedWith("tx-1");
        when(client.get("tx-1")).thenReturn(tx("Complete", PNR));
        when(callback.authenticated(any())).thenThrow(new IllegalStateException("boom"));
        assertSame(errorPage, endpoint.back("s", "tx-1"));
        verify(forms).setError(UNEXPECTED_ERROR);
    }

    @Test
    void failedStartGoesThroughTheReturnEndpoint() throws Exception {
        AuthenticationRequest request = startRequest();
        when(client.createAuth(any(), any())).thenThrow(new NullPointerException());

        Response res = provider.performLogin(request);

        assertEquals(303, res.getStatus());
        assertEquals("https://kc/broker/bankid/endpoint/return?state=st", res.getLocation().toString());
        verify(authSession).removeAuthNote(NOTE_TX);
        verify(authSession, never()).setAuthNote(any(), any());
    }

    @Test
    void startSendsTheBrowserToMimerBankId() throws Exception {
        AuthenticationRequest request = startRequest();
        when(client.createAuth("203.0.113.7", "https://kc/broker/bankid/endpoint/return?state=st"))
                .thenReturn(new MimerBankIdClient.Created("tx-1", "https://bankid/t/tx-1/"));

        Response res = provider.performLogin(request);

        assertEquals(303, res.getStatus());
        assertEquals("https://bankid/t/tx-1/", res.getLocation().toString());
        verify(authSession).setAuthNote(NOTE_TX, "tx-1");
    }

    @Test
    void returnUrlKeepsStateOnBrokerEndpoint() {
        String url = MimerBankIdIdentityProvider.returnUrl(
                "https://auth.dev.mimer.nu/realms/mimer-contacts/broker/bankid/endpoint", "abc.def-ghi_jkl");
        assertEquals("https://auth.dev.mimer.nu/realms/mimer-contacts/broker/bankid/endpoint/return?state=abc.def-ghi_jkl", url);
    }

    @Test
    void describeNamesTheExceptionType() {
        assertEquals("NullPointerException", MimerBankIdIdentityProvider.describe(new NullPointerException()));
        assertEquals("IOException: token: HTTP 401", MimerBankIdIdentityProvider.describe(new IOException("token: HTTP 401")));
    }

    private AuthenticationRequest startRequest() {
        ClientConnection connection = mock(ClientConnection.class);
        when(connection.getRemoteAddr()).thenReturn("203.0.113.7");
        when(context.getConnection()).thenReturn(connection);
        IdentityBrokerState state = mock(IdentityBrokerState.class);
        when(state.getEncoded()).thenReturn("st");
        AuthenticationRequest request = mock(AuthenticationRequest.class);
        when(request.getRedirectUri()).thenReturn("https://kc/broker/bankid/endpoint");
        when(request.getState()).thenReturn(state);
        when(request.getAuthenticationSession()).thenReturn(authSession);
        return request;
    }
}
