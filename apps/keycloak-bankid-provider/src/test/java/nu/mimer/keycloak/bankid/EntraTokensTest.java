package nu.mimer.keycloak.bankid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.io.IOException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.keycloak.models.KeycloakSession;

class EntraTokensTest {

    private static final long IN_AN_HOUR = 3_600_000;

    private final KeycloakSession session = mock(KeycloakSession.class);
    private final MimerBankIdConfig config = new MimerBankIdConfig();
    private EntraTokens tokens;

    @BeforeEach
    void setUp() {
        config.setInternalId("idp-realm-a");
        config.getConfig().put("tokenUrl", "https://login.example/token");
        config.getConfig().put("clientId", "client");
        config.getConfig().put("scope", "api://bankid/.default");
        tokens = new EntraTokens(session, config);
    }

    @AfterEach
    void clearCache() {
        EntraTokens.CACHE.clear();
    }

    private void cache(String value) throws IOException {
        EntraTokens.CACHE.put(tokens.key(), new EntraTokens.CachedToken(value, System.currentTimeMillis() + IN_AN_HOUR));
    }

    @Test
    void cachedTokenIsReusedWithoutHttp() throws Exception {
        cache("cached");
        assertEquals("cached", tokens.get());
    }

    @Test
    void invalidateDropsTheCachedToken() throws Exception {
        cache("revoked");
        tokens.invalidate();
        assertTrue(EntraTokens.CACHE.isEmpty());
    }

    @Test
    void cachedTokenIsNotSharedWithAnotherIdentityProvider() throws Exception {
        cache("realm-a-token");
        // Another realm's provider naming the same token URL, client and scope: it must miss the
        // cache and fetch its own token with its own secret.
        MimerBankIdConfig other = new MimerBankIdConfig();
        other.setInternalId("idp-realm-b");
        other.getConfig().putAll(config.getConfig());
        EntraTokens otherTokens = new EntraTokens(session, other);

        assertNotEquals(tokens.key(), otherTokens.key());
        assertNull(EntraTokens.CACHE.get(otherTokens.key()));
    }

    @Test
    void providerWithoutInternalIdGetsNoCachedToken() {
        config.setInternalId(null);
        IOException e = assertThrows(IOException.class, tokens::get);
        assertEquals("identity provider internal id is not set", e.getMessage());
    }
}
