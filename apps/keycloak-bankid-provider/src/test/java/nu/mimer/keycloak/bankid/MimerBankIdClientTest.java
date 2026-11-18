package nu.mimer.keycloak.bankid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.keycloak.broker.provider.util.SimpleHttp;
import org.keycloak.models.KeycloakSession;
import org.keycloak.vault.VaultStringSecret;
import org.keycloak.vault.VaultTranscriber;

class MimerBankIdClientTest {

    private static final String SECRET_REF = "${vault.bankid-client-secret}";

    private final KeycloakSession session = mock(KeycloakSession.class);
    private final VaultTranscriber vault = mock(VaultTranscriber.class);
    private final MimerBankIdConfig config = new MimerBankIdConfig();
    private MimerBankIdClient client;

    @BeforeEach
    void setUp() {
        when(session.vault()).thenReturn(vault);
        config.getConfig().put("tokenUrl", "https://login.example/token");
        config.getConfig().put("clientId", "client");
        config.getConfig().put("scope", "api://bankid/.default");
        client = new MimerBankIdClient(session, config);
    }

    @AfterEach
    void clearTokens() {
        MimerBankIdClient.TOKENS.clear();
    }

    private void vaultHas(String ref, Optional<String> value) {
        VaultStringSecret secret = mock(VaultStringSecret.class);
        when(secret.get()).thenReturn(value);
        when(vault.getStringSecret(ref)).thenReturn(secret);
    }

    @Test
    void vaultReferenceResolves() throws Exception {
        vaultHas(SECRET_REF, Optional.of("s3cret"));
        assertEquals("s3cret", client.secret("clientSecret", SECRET_REF));
    }

    @Test
    void missingVaultKeyNamesTheKeyInsteadOfSendingThePlaceholder() {
        vaultHas(SECRET_REF, Optional.empty());
        IOException e = assertThrows(IOException.class, () -> client.secret("clientSecret", SECRET_REF));
        assertTrue(e.getMessage().contains("vault key bankid-client-secret not found"), e.getMessage());
    }

    @Test
    void plaintextSecretIsRefused() {
        IOException e = assertThrows(IOException.class, () -> client.secret("apimKey", "plain-key"));
        assertTrue(e.getMessage().startsWith("apimKey must be a ${vault."), e.getMessage());
        verifyNoInteractions(vault);
    }

    @Test
    void unsetSecretIsRefused() {
        IOException e = assertThrows(IOException.class, () -> client.secret("apimKey", null));
        assertEquals("apimKey is not set", e.getMessage());
    }

    @Test
    void missingRemoteAddressIsAnErrorNotAnNpe() {
        IOException e = assertThrows(IOException.class, () -> client.createAuth(null, "https://kc/return"));
        assertTrue(e.getMessage().contains("endUserIp"), e.getMessage());
    }

    @Test
    void cachedTokenIsReusedWithoutHttp() throws Exception {
        MimerBankIdClient.TOKENS.put(client.tokenKey(),
                new MimerBankIdClient.CachedToken("cached", System.currentTimeMillis() + 3_600_000));
        assertEquals("cached", client.token());
    }

    @Test
    void unauthorizedFromMimerBankIdDropsTheCachedToken() throws Exception {
        MimerBankIdClient.TOKENS.put(client.tokenKey(),
                new MimerBankIdClient.CachedToken("revoked", System.currentTimeMillis() + 3_600_000));
        SimpleHttp.Response res = mock(SimpleHttp.Response.class);
        when(res.getStatus()).thenReturn(401);
        when(res.asJson()).thenThrow(new IOException("not json"));

        IOException e = assertThrows(IOException.class, () -> client.okJson(res, "get transaction", true));

        assertEquals("get transaction: HTTP 401", e.getMessage());
        assertTrue(MimerBankIdClient.TOKENS.isEmpty());
        verify(res).close();
    }

    @Test
    void entraErrorKeepsOnlyTheCodes() throws Exception {
        SimpleHttp.Response res = mock(SimpleHttp.Response.class);
        when(res.getStatus()).thenReturn(401);
        when(res.asJson()).thenReturn(new ObjectMapper().readTree(
                "{\"error\":\"invalid_client\",\"error_description\":\"AADSTS7000215: Invalid client secret provided. Trace ID: x\"}"));
        MimerBankIdClient.TOKENS.put(client.tokenKey(),
                new MimerBankIdClient.CachedToken("kept", System.currentTimeMillis() + 3_600_000));

        IOException e = assertThrows(IOException.class, () -> client.okJson(res, "token", false));

        assertEquals("token: HTTP 401 invalid_client AADSTS7000215", e.getMessage());
        // The token call itself does not use a cached token, so its 401 leaves the cache alone.
        assertEquals("kept", MimerBankIdClient.TOKENS.get(client.tokenKey()).value());
    }
}
