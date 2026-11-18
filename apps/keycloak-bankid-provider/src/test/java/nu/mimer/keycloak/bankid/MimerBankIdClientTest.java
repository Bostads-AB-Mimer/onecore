package nu.mimer.keycloak.bankid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.keycloak.broker.provider.util.SimpleHttp;
import org.keycloak.models.KeycloakSession;
import org.keycloak.vault.VaultStringSecret;
import org.keycloak.vault.VaultTranscriber;

class MimerBankIdClientTest {

    private static final String APIM_REF = "${vault.bankid-apim-key}";

    private final KeycloakSession session = mock(KeycloakSession.class);
    private final EntraTokens tokens = mock(EntraTokens.class);
    private final MimerBankIdConfig config = new MimerBankIdConfig();
    private final SimpleHttp request = mock(SimpleHttp.class, RETURNS_SELF);
    private MimerBankIdClient client;

    @BeforeEach
    void setUp() throws Exception {
        VaultTranscriber vault = mock(VaultTranscriber.class);
        VaultStringSecret apimKey = mock(VaultStringSecret.class);
        when(apimKey.get()).thenReturn(Optional.of("apim-key"));
        when(vault.getStringSecret(APIM_REF)).thenReturn(apimKey);
        when(session.vault()).thenReturn(vault);
        when(tokens.get()).thenReturn("token");
        config.getConfig().put("apimKey", APIM_REF);
        client = new MimerBankIdClient(session, config, tokens);
    }

    private SimpleHttp.Response answers(int status, JsonNode body) throws IOException {
        SimpleHttp.Response res = mock(SimpleHttp.Response.class);
        when(res.getStatus()).thenReturn(status);
        when(res.asJson()).thenReturn(body);
        when(request.asResponse()).thenReturn(res);
        return res;
    }

    @Test
    void sendCarriesTokenAndApimKey() throws Exception {
        JsonNode body = new ObjectMapper().readTree("{\"id\":\"tx-1\"}");
        SimpleHttp.Response res = answers(200, body);

        assertSame(body, client.send(request, "get transaction"));

        verify(request).auth("token");
        verify(request).header("Ocp-Apim-Subscription-Key", "apim-key");
        verify(res).close();
    }

    @Test
    void unauthorizedDropsTheCachedToken() throws Exception {
        SimpleHttp.Response res = answers(401, null);

        IOException e = assertThrows(IOException.class, () -> client.send(request, "get transaction"));

        assertEquals("get transaction: HTTP 401", e.getMessage());
        verify(tokens).invalidate();
        verify(res).close();
    }

    @Test
    void otherErrorsKeepTheCachedToken() throws Exception {
        answers(503, null);
        assertThrows(IOException.class, () -> client.send(request, "get transaction"));
        verify(tokens, never()).invalidate();
    }

    @Test
    void missingRemoteAddressIsAnErrorNotAnNpe() {
        IOException e = assertThrows(IOException.class, () -> client.createAuth(null, "https://kc/return"));
        assertTrue(e.getMessage().contains("endUserIp"), e.getMessage());
        verifyNoInteractions(tokens);
    }
}
